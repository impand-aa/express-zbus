import { getSession } from '../auth/sessions.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'authentication required' })
  }

  const session = getSession(token)
  if (!session) {
    return res.status(401).json({ error: 'invalid or expired session' })
  }

  req.session = session
  req.token = token
  next()
}
