import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env.js'
import { LoginEventModel } from '../models/LoginEvent.js'
import { UserModel } from '../models/User.js'
import { sendPasswordResetOtpEmail, sendVerificationOtpEmail } from './emailService.js'

const DEFAULT_ADMIN_USERNAME = 'DurgaPrasad'
const DEFAULT_ADMIN_PASSWORD = '2300031561'
const googleClient = new OAuth2Client()

function normalize(role) {
  return String(role || '').toLowerCase() === 'admin' ? 'admin' : 'user'
}

async function logAttempt({ useMongo, username, role, status, reason, ipAddress }) {
  if (!useMongo) return
  await LoginEventModel.create({ username, role, status, reason, ipAddress })
}

function validateUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_.-]{3,40}$/.test(username)
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function sanitizeUsernameCandidate(value) {
  const sanitized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 40)
  if (!sanitized) return 'user'
  if (sanitized.length >= 3) return sanitized
  return `user${sanitized}`.slice(0, 40)
}

async function createUniqueUsername(baseCandidate) {
  const safeBase = sanitizeUsernameCandidate(baseCandidate)
  let candidate = safeBase
  let counter = 1
  // Keep usernames deterministic and unique if the base name already exists.
  while (await UserModel.exists({ username: candidate })) {
    const suffix = `_${counter}`
    candidate = `${safeBase.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`
    counter += 1
  }
  return candidate
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createEmailOtp() {
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = hashToken(otp)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  return { otp, otpHash, expiresAt }
}

function isDefaultAdminCredentials(username, password) {
  return username === DEFAULT_ADMIN_USERNAME && password === DEFAULT_ADMIN_PASSWORD
}

function getMongoPasswordFromUri(uri) {
  if (!uri) return ''
  try {
    const parsed = new URL(uri)
    return decodeURIComponent(parsed.password || '')
  } catch {
    return ''
  }
}

function resolveAdminAccessKey() {
  // Prefer Mongo URI password as requested; fallback keeps current deployments working.
  return getMongoPasswordFromUri(env.mongoUri) || env.adminAccessKey
}

export async function registerWithRole({ useMongo, username, email, password }) {
  if (!useMongo) {
    throw new Error('MongoDB is required for registration.')
  }

  const normalizedRole = 'user'
  if (!validateUsername(username)) {
    throw new Error('Username must be 3-40 chars with letters, numbers, _, ., or -')
  }
  if (!validatePassword(password)) {
    throw new Error('Password must be at least 6 characters long.')
  }
  if (!validateEmail(email)) {
    throw new Error('Email is invalid.')
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const existing = await UserModel.findOne({
    $or: [{ username }, { email: normalizedEmail }],
  }).lean()
  if (existing) {
    throw new Error(existing.username === username ? 'Username already exists.' : 'Email already exists.')
  }

  const { otp, otpHash, expiresAt } = createEmailOtp()
  const passwordHash = await bcrypt.hash(password, 10)
  const created = await UserModel.create({
    username,
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
    isEmailVerified: false,
    emailVerificationOtpHash: otpHash,
    emailVerificationOtpExpiresAt: expiresAt,
  })

  const emailStatus = await sendVerificationOtpEmail({
    toEmail: normalizedEmail,
    username,
    otp,
  })
  if (!emailStatus.sent) {
    throw new Error('Email service is not configured. Please configure SMTP for OTP delivery.')
  }

  return {
    id: created._id.toString(),
    username: created.username,
    email: created.email,
    role: created.role,
    verificationRequired: true,
    emailDelivery: 'sent',
  }
}

export async function loginWithRole({
  useMongo,
  username,
  password,
  role,
  adminAccessKey,
  ipAddress,
}) {
  if (!useMongo) {
    throw new Error('MongoDB is required for login and login-event storage.')
  }

  const adminByDefaultCredentials = isDefaultAdminCredentials(username, password)
  const normalizedRole = adminByDefaultCredentials ? 'admin' : normalize(role)

  if (adminByDefaultCredentials) {
    const expectedAdminAccessKey = resolveAdminAccessKey()
    if (!expectedAdminAccessKey) {
      throw new Error('Admin passkey source is not configured on server.')
    }
    if (adminAccessKey !== expectedAdminAccessKey) {
      await logAttempt({
        useMongo,
        username,
        role: normalizedRole,
        status: 'failed',
        reason: 'admin_access_key_mismatch',
        ipAddress,
      })
      throw new Error('Invalid admin access key.')
    }

    const token = jwt.sign(
      {
        sub: 'default-admin',
        username: DEFAULT_ADMIN_USERNAME,
        role: 'admin',
      },
      env.jwtSecret,
      { expiresIn: '12h' },
    )

    await logAttempt({
      useMongo,
      username,
      role: normalizedRole,
      status: 'success',
      reason: '',
      ipAddress,
    })

    return {
      token,
      user: {
        username: DEFAULT_ADMIN_USERNAME,
        role: 'admin',
      },
    }
  }

  const user = await UserModel.findOne({ username }).lean()
  if (!user) {
    await logAttempt({
      useMongo,
      username,
      role: normalizedRole,
      status: 'failed',
      reason: 'user_not_found',
      ipAddress,
    })
    throw new Error('Invalid credentials.')
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash)
  if (!passwordOk || user.role !== normalizedRole) {
    await logAttempt({
      useMongo,
      username,
      role: normalizedRole,
      status: 'failed',
      reason: 'invalid_credentials',
      ipAddress,
    })
    throw new Error('Invalid credentials.')
  }

  if (user.email && user.isEmailVerified === false) {
    await logAttempt({
      useMongo,
      username,
      role: normalizedRole,
      status: 'failed',
      reason: 'email_not_verified',
      ipAddress,
    })
    throw new Error('Please verify your email before login.')
  }

  if (normalizedRole === 'admin') {
    const expectedAdminAccessKey = resolveAdminAccessKey()
    if (!expectedAdminAccessKey) {
      throw new Error('Admin passkey source is not configured on server.')
    }
    if (adminAccessKey !== expectedAdminAccessKey) {
      await logAttempt({
        useMongo,
        username,
        role: normalizedRole,
        status: 'failed',
        reason: 'admin_access_key_mismatch',
        ipAddress,
      })
      throw new Error('Invalid admin access key.')
    }
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: '12h' },
  )

  await logAttempt({
    useMongo,
    username,
    role: normalizedRole,
    status: 'success',
    reason: '',
    ipAddress,
  })

  return {
    token,
    user: {
      username: user.username,
      role: user.role,
    },
  }
}

export async function loginWithGoogle({ useMongo, idToken, ipAddress }) {
  if (!useMongo) {
    throw new Error('MongoDB is required for login and login-event storage.')
  }
  if (!env.googleClientId) {
    throw new Error('Google login is not configured on server.')
  }
  if (!idToken) {
    throw new Error('Google credential token is required.')
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    })
    payload = ticket.getPayload()
  } catch {
    await logAttempt({
      useMongo,
      username: 'google_user',
      role: 'user',
      status: 'failed',
      reason: 'google_token_invalid',
      ipAddress,
    })
    throw new Error('Invalid Google token.')
  }

  const email = String(payload?.email || '').trim().toLowerCase()
  if (!email || payload?.email_verified === false) {
    await logAttempt({
      useMongo,
      username: 'google_user',
      role: 'user',
      status: 'failed',
      reason: 'google_email_invalid',
      ipAddress,
    })
    throw new Error('Google account email is not verified.')
  }

  let user = await UserModel.findOne({ email })
  if (!user) {
    const usernameSeed = payload?.name || email.split('@')[0] || 'user'
    const username = await createUniqueUsername(usernameSeed)
    const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10)

    user = await UserModel.create({
      username,
      email,
      passwordHash: randomPasswordHash,
      role: 'user',
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationOtpHash: null,
      emailVerificationOtpExpiresAt: null,
    })
  } else if (user.isEmailVerified === false) {
    user.isEmailVerified = true
    user.emailVerificationTokenHash = null
    user.emailVerificationExpiresAt = null
    user.emailVerificationOtpHash = null
    user.emailVerificationOtpExpiresAt = null
    await user.save()
  }

  if (user.role === 'admin') {
    throw new Error('Google login is disabled for admin accounts.')
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: '12h' },
  )

  await logAttempt({
    useMongo,
    username: user.username,
    role: user.role,
    status: 'success',
    reason: '',
    ipAddress,
  })

  return {
    token,
    user: {
      username: user.username,
      role: user.role,
    },
  }
}

export async function verifyEmailToken({ useMongo, token }) {
  if (!useMongo) throw new Error('MongoDB is required for email verification.')
  if (!token) throw new Error('Verification token is required.')

  const tokenHash = hashToken(token)
  const user = await UserModel.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
  })

  if (!user) {
    throw new Error('Verification link is invalid or expired.')
  }

  user.isEmailVerified = true
  user.emailVerificationTokenHash = null
  user.emailVerificationExpiresAt = null
  await user.save()

  return {
    verified: true,
    username: user.username,
    email: user.email,
  }
}

export async function verifyEmailOtp({ useMongo, email, otp }) {
  if (!useMongo) throw new Error('MongoDB is required for email verification.')
  if (!email || !otp) throw new Error('Email and OTP are required.')

  const normalizedEmail = String(email).trim().toLowerCase()
  const otpHash = hashToken(String(otp).trim())
  const user = await UserModel.findOne({
    email: normalizedEmail,
    emailVerificationOtpHash: otpHash,
    emailVerificationOtpExpiresAt: { $gt: new Date() },
  })
  if (!user) throw new Error('OTP is invalid or expired.')

  user.isEmailVerified = true
  user.emailVerificationTokenHash = null
  user.emailVerificationExpiresAt = null
  user.emailVerificationOtpHash = null
  user.emailVerificationOtpExpiresAt = null
  await user.save()

  return {
    verified: true,
    username: user.username,
    email: user.email,
  }
}

export async function resendEmailOtp({ useMongo, email }) {
  if (!useMongo) throw new Error('MongoDB is required for email verification.')
  if (!email) throw new Error('Email is required.')

  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await UserModel.findOne({ email: normalizedEmail })
  if (!user) throw new Error('User with this email was not found.')
  if (user.isEmailVerified) throw new Error('Email is already verified.')

  const { otp, otpHash, expiresAt } = createEmailOtp()
  user.emailVerificationOtpHash = otpHash
  user.emailVerificationOtpExpiresAt = expiresAt
  await user.save()

  const emailStatus = await sendVerificationOtpEmail({
    toEmail: user.email,
    username: user.username,
    otp,
  })
  if (!emailStatus.sent) {
    throw new Error('Email service is not configured. Please configure SMTP for OTP delivery.')
  }

  return { sent: true }
}

export async function requestPasswordResetOtp({ useMongo, email }) {
  if (!useMongo) throw new Error('MongoDB is required for password reset.')
  if (!email) throw new Error('Email is required.')

  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await UserModel.findOne({ email: normalizedEmail })

  // Do not reveal whether the account exists.
  if (!user) return { sent: true }

  const { otp, otpHash, expiresAt } = createEmailOtp()
  user.passwordResetOtpHash = otpHash
  user.passwordResetOtpExpiresAt = expiresAt
  await user.save()

  const emailStatus = await sendPasswordResetOtpEmail({
    toEmail: user.email,
    username: user.username,
    otp,
  })
  if (!emailStatus.sent) {
    throw new Error('Email service is not configured. Please configure SMTP for OTP delivery.')
  }

  return { sent: true }
}

export async function resetPasswordWithOtp({ useMongo, email, otp, newPassword }) {
  if (!useMongo) throw new Error('MongoDB is required for password reset.')
  if (!email || !otp || !newPassword) throw new Error('Email, OTP and new password are required.')
  if (!validatePassword(newPassword)) throw new Error('Password must be at least 6 characters long.')

  const normalizedEmail = String(email).trim().toLowerCase()
  const otpHash = hashToken(String(otp).trim())
  const user = await UserModel.findOne({
    email: normalizedEmail,
    passwordResetOtpHash: otpHash,
    passwordResetOtpExpiresAt: { $gt: new Date() },
  })
  if (!user) throw new Error('OTP is invalid or expired.')

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  user.passwordResetOtpHash = null
  user.passwordResetOtpExpiresAt = null
  await user.save()

  return { reset: true }
}

export async function getRecentLoginEvents({ useMongo, limit = 30 }) {
  if (!useMongo) return []
  return LoginEventModel.find({}).sort({ createdAt: -1 }).limit(limit).lean()
}

export async function listUsers({ useMongo }) {
  if (!useMongo) return []
  return UserModel.find({}).sort({ createdAt: -1 }).select('username email role isEmailVerified createdAt').lean()
}

export async function deleteUserById({ useMongo, userId, actorUsername }) {
  if (!useMongo) throw new Error('MongoDB is required for user management.')
  const existing = await UserModel.findById(userId).lean()
  if (!existing) throw new Error('User not found.')
  if (existing.username === actorUsername) {
    throw new Error('Admin cannot delete their own account.')
  }
  await UserModel.deleteOne({ _id: userId })
  return { deleted: true }
}

export async function updateUserRoleById({ useMongo, userId, role, actorUsername }) {
  if (!useMongo) throw new Error('MongoDB is required for user management.')
  const normalizedRole = normalize(role)
  if (!['admin', 'user'].includes(normalizedRole)) {
    throw new Error('Role must be admin or user.')
  }

  const existing = await UserModel.findById(userId).lean()
  if (!existing) throw new Error('User not found.')
  if (existing.username === actorUsername) {
    throw new Error('Admin cannot change their own role.')
  }
  if (existing.role === normalizedRole) {
    throw new Error(`User is already ${normalizedRole}.`)
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { role: normalizedRole },
    { new: true, runValidators: true, select: 'username role createdAt' },
  ).lean()

  return {
    updated: true,
    user: updated,
  }
}
