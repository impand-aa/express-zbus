import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { createSession, destroySession, destroySessionsForUser, markPasswordChanged } from '../auth/sessions.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { listUserOrganizations } from '../organizations.js'

const router = Router()
const SALT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

// Accounts are provisioned directly in Atlas; there is no self-registration endpoint.
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {}
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'username and password are required' })
    }

    const users = getDb().collection('users')
    const user = await users.findOne({ username })
    const isMatch = user ? await bcrypt.compare(password, user.password) : false
    if (!isMatch) {
      return res.status(401).json({ error: 'invalid credentials' })
    }

    const token = createSession(user)
    res.json({
      token,
      userId: user._id.toString(),
      username: user.username,
      mustChangePassword: user.mustChangePassword !== false,
      siteAdmin: user.siteAdmin === true,
      organizations: await listUserOrganizations(user._id.toString()),
    })
  } catch (err) {
    next(err)
  }
})

// Required on first login (or whenever mustChangePassword is set) before using the app.
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' })
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` })
    }

    const users = getDb().collection('users')
    const user = await users.findOne({ _id: new ObjectId(req.session.userId) })
    if (!user) {
      return res.status(401).json({ error: 'invalid or expired session' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: 'current password is incorrect' })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await users.updateOne(
      { _id: user._id },
      { $set: { password: newPasswordHash, mustChangePassword: false } },
    )
    markPasswordChanged(req.token)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// Lets the client verify/restore a saved token without re-entering credentials. Organizations are
// re-read each time so membership and site admin changes show up without signing in again.
router.get('/session', requireAuth, async (req, res, next) => {
  try {
    const user = await getDb().collection('users').findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { siteAdmin: 1 } },
    )
    if (!user) {
      destroySessionsForUser(req.session.userId)
      return res.status(401).json({ error: 'invalid or expired session' })
    }

    res.json({
      userId: req.session.userId,
      username: req.session.username,
      mustChangePassword: req.session.mustChangePassword,
      siteAdmin: user.siteAdmin === true,
      organizations: await listUserOrganizations(req.session.userId),
    })
  } catch (err) { next(err) }
})

router.post('/logout', requireAuth, (req, res) => {
  destroySession(req.token)
  res.json({ success: true })
})

export default router
