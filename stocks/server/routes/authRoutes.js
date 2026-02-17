import express from 'express'
import { requireAuth, requireRole } from '../middlewares/auth.js'
import {
  deleteUserById,
  getRecentLoginEvents,
  loginWithGoogle,
  listUsers,
  loginWithRole,
  requestPasswordResetOtp,
  registerWithRole,
  resetPasswordWithOtp,
  resendEmailOtp,
  updateUserRoleById,
  verifyEmailOtp,
} from '../services/authService.js'
import { getRecentRuns } from '../services/runStore.js'

export function createAuthRouter({ useMongo }) {
  const router = express.Router()

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password, role, adminAccessKey } = req.body ?? {}
      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required.' })
      }

      const result = await loginWithRole({
        useMongo,
        username,
        password,
        role,
        adminAccessKey,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      })
      return res.json(result)
    } catch (error) {
      if (
        error?.message?.toLowerCase().includes('invalid') ||
        error?.message?.includes('required') ||
        error?.message?.toLowerCase().includes('verify')
      ) {
        return res.status(401).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/register', async (req, res, next) => {
    try {
      const { username, email, password } = req.body ?? {}
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email and password are required.' })
      }
      const created = await registerWithRole({
        useMongo,
        username,
        email,
        password,
      })
      return res.status(201).json({ user: created })
    } catch (error) {
      if (
        error?.message?.includes('required') ||
        error?.message?.includes('exists') ||
        error?.message?.includes('Invalid') ||
        error?.message?.includes('invalid') ||
        error?.message?.includes('Username') ||
        error?.message?.includes('Password') ||
        error?.message?.includes('Email') ||
        error?.message?.includes('SMTP') ||
        error?.message?.includes('email service')
      ) {
        return res.status(400).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/google', async (req, res, next) => {
    try {
      const { idToken } = req.body ?? {}
      if (!idToken) {
        return res.status(400).json({ error: 'Google credential token is required.' })
      }
      const result = await loginWithGoogle({
        useMongo,
        idToken,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      })
      return res.json(result)
    } catch (error) {
      if (
        error?.message?.toLowerCase().includes('google') ||
        error?.message?.toLowerCase().includes('token') ||
        error?.message?.toLowerCase().includes('required')
      ) {
        return res.status(401).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/verify-email-otp', async (req, res, next) => {
    try {
      const { email, otp } = req.body ?? {}
      const result = await verifyEmailOtp({ useMongo, email, otp })
      return res.json(result)
    } catch (error) {
      if (
        error?.message?.toLowerCase().includes('otp') ||
        error?.message?.toLowerCase().includes('email') ||
        error?.message?.toLowerCase().includes('required')
      ) {
        return res.status(400).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/resend-email-otp', async (req, res, next) => {
    try {
      const { email } = req.body ?? {}
      const result = await resendEmailOtp({ useMongo, email })
      return res.json(result)
    } catch (error) {
      if (error?.message?.toLowerCase().includes('email') || error?.message?.toLowerCase().includes('user')) {
        return res.status(400).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/forgot-password-otp', async (req, res, next) => {
    try {
      const { email } = req.body ?? {}
      const result = await requestPasswordResetOtp({ useMongo, email })
      return res.json(result)
    } catch (error) {
      if (
        error?.message?.toLowerCase().includes('email') ||
        error?.message?.toLowerCase().includes('required') ||
        error?.message?.toLowerCase().includes('smtp')
      ) {
        return res.status(400).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.post('/reset-password-otp', async (req, res, next) => {
    try {
      const { email, otp, newPassword } = req.body ?? {}
      const result = await resetPasswordWithOtp({ useMongo, email, otp, newPassword })
      return res.json(result)
    } catch (error) {
      if (
        error?.message?.toLowerCase().includes('otp') ||
        error?.message?.toLowerCase().includes('password') ||
        error?.message?.toLowerCase().includes('required') ||
        error?.message?.toLowerCase().includes('email')
      ) {
        return res.status(400).json({ error: error.message })
      }
      return next(error)
    }
  })

  router.get('/events', requireAuth, requireRole(['admin']), async (_req, res, next) => {
    try {
      const rows = await getRecentLoginEvents({ useMongo, limit: 50 })
      res.json({ rows })
    } catch (error) {
      next(error)
    }
  })

  router.get('/users', requireAuth, requireRole(['admin']), async (_req, res, next) => {
    try {
      const rows = await listUsers({ useMongo })
      res.json({ rows })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/users/:id', requireAuth, requireRole(['admin']), async (req, res, next) => {
    try {
      const result = await deleteUserById({
        useMongo,
        userId: req.params.id,
        actorUsername: req.auth.username,
      })
      res.json(result)
    } catch (error) {
      if (error?.message?.includes('not found') || error?.message?.includes('cannot delete')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.patch('/users/:id/role', requireAuth, requireRole(['admin']), async (req, res, next) => {
    try {
      const { role } = req.body ?? {}
      if (!role) {
        return res.status(400).json({ error: 'role is required.' })
      }
      const result = await updateUserRoleById({
        useMongo,
        userId: req.params.id,
        role,
        actorUsername: req.auth.username,
      })
      res.json(result)
    } catch (error) {
      if (
        error?.message?.includes('not found') ||
        error?.message?.includes('cannot') ||
        error?.message?.includes('Role') ||
        error?.message?.includes('already')
      ) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.get('/searches', requireAuth, requireRole(['admin']), async (_req, res, next) => {
    try {
      const rows = await getRecentRuns({ useMongo, limit: 100 })
      res.json({ rows })
    } catch (error) {
      next(error)
    }
  })

  return router
}
