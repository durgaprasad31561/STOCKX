import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

function canSendEmail() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.emailFrom)
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  })
}

function normalizeSmtpError(error) {
  const code = String(error?.code || '').toUpperCase()
  const message = String(error?.message || '')
  const isTimeout = code === 'ETIMEDOUT' || /timed?\s*out/i.test(message)
  if (isTimeout) {
    return new Error('SMTP connection timed out. Check SMTP_HOST/PORT/SECURE and Gmail App Password.')
  }
  return error
}

export async function sendVerificationEmail({ toEmail, username, verificationUrl }) {
  if (!canSendEmail()) {
    return {
      sent: false,
      reason: 'smtp_not_configured',
      verificationUrl,
    }
  }

  const transporter = createTransporter()
  try {
    await transporter.sendMail({
      from: env.emailFrom,
      to: toEmail,
      subject: 'Verify your StockSentix account',
      text: [
        `Hi ${username},`,
        '',
        'Please verify your email by opening this link:',
        verificationUrl,
        '',
        'This link expires in 24 hours.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p>Hi ${username},</p>
          <p>Please verify your StockSentix account by clicking the button below:</p>
          <p><a href="${verificationUrl}" style="display:inline-block;padding:10px 16px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p>
          <p>If the button does not work, open this link:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This link expires in 24 hours.</p>
        </div>
      `,
    })
  } catch (error) {
    throw normalizeSmtpError(error)
  }

  return { sent: true }
}

export async function sendVerificationOtpEmail({ toEmail, username, otp }) {
  if (!canSendEmail()) {
    return {
      sent: false,
      reason: 'smtp_not_configured',
    }
  }

  const transporter = createTransporter()
  try {
    await transporter.sendMail({
      from: env.emailFrom,
      to: toEmail,
      subject: 'Your StockSentix verification OTP',
      text: [
        `Hi ${username},`,
        '',
        `Your verification OTP is: ${otp}`,
        '',
        'OTP expires in 10 minutes.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p>Hi ${username},</p>
          <p>Your verification OTP is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p>
          <p>OTP expires in 10 minutes.</p>
        </div>
      `,
    })
  } catch (error) {
    throw normalizeSmtpError(error)
  }

  return { sent: true }
}

export async function sendPasswordResetOtpEmail({ toEmail, username, otp }) {
  if (!canSendEmail()) {
    return {
      sent: false,
      reason: 'smtp_not_configured',
    }
  }

  const transporter = createTransporter()
  try {
    await transporter.sendMail({
      from: env.emailFrom,
      to: toEmail,
      subject: 'Your StockSentix password reset OTP',
      text: [
        `Hi ${username},`,
        '',
        `Your password reset OTP is: ${otp}`,
        '',
        'OTP expires in 10 minutes.',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p>Hi ${username},</p>
          <p>Your password reset OTP is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p>
          <p>OTP expires in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    })
  } catch (error) {
    throw normalizeSmtpError(error)
  }

  return { sent: true }
}
