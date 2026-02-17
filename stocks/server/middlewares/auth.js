import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

function parseBearer(authHeader = '') {
  if (!authHeader.startsWith('Bearer ')) return ''
  return authHeader.slice('Bearer '.length).trim()
}

export function requireAuth(req, res, next) {
  const token = parseBearer(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token.' })
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    req.auth = decoded
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token.' })
  }
}

export function requireRole(roles = []) {
  const accepted = new Set(roles)
  return (req, res, next) => {
    const role = req?.auth?.role
    if (!accepted.has(role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role.' })
    }
    return next()
  }
}

