import crypto from 'node:crypto'

// In-memory session store: acceptable for a single-instance, admin-provisioned private site.
const sessions = new Map()

export function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    userId: user._id.toString(),
    username: user.username,
    mustChangePassword: user.mustChangePassword !== false,
  })
  return token
}

export function getSession(token) {
  return sessions.get(token)
}

export function markPasswordChanged(token) {
  const session = sessions.get(token)
  if (session) session.mustChangePassword = false
}

export function destroySession(token) {
  sessions.delete(token)
}

// Used when an account is deleted or its password is reset, so existing logins stop working at once.
export function destroySessionsForUser(userId) {
  for (const [token, session] of sessions) {
    if (session.userId === userId) sessions.delete(token)
  }
}
