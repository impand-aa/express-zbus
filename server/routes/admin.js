import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { getDb } from '../db.js'
import { destroySessionsForUser } from '../auth/sessions.js'
import { ORGANIZATION_ROLES, parseObjectIdOrNull } from '../organizations.js'

// Site admin panel API, mounted at /admin behind requireAuth + requireSiteAdmin.
const router = Router()
const SALT_ROUNDS = 10
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 100
const DUPLICATE_KEY_ERROR = 11000

// Shown to the site admin once; the user must replace it on first login.
function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

async function hashTemporaryPassword() {
  const temporaryPassword = generateTemporaryPassword()
  return { temporaryPassword, passwordHash: await bcrypt.hash(temporaryPassword, SALT_ROUNDS) }
}

function normalizeOrganizationName(rawName) {
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  return name && name.length <= MAX_NAME_LENGTH ? name : null
}

function toOrganizationRecord(doc) {
  return { id: doc._id.toString(), name: doc.name, slug: doc.slug, createdAt: doc.createdAt }
}

function toUserRecord(doc, memberships) {
  const userId = doc._id.toString()
  return {
    id: userId,
    username: doc.username,
    siteAdmin: doc.siteAdmin === true,
    mustChangePassword: doc.mustChangePassword !== false,
    memberships: memberships
      .filter((membership) => membership.userId.toString() === userId)
      .map((membership) => ({ organizationId: membership.organizationId.toString(), role: membership.role })),
  }
}

// Resolves :userId, rejecting malformed ids, unknown users and (optionally) the caller's own account.
async function loadTargetUser(req, res, { forbidSelf } = {}) {
  const userId = parseObjectIdOrNull(req.params.userId)
  if (!userId) {
    res.status(400).json({ error: 'invalid user id' })
    return null
  }
  if (forbidSelf && userId.toString() === req.session.userId) {
    res.status(400).json({ error: forbidSelf })
    return null
  }
  const user = await getDb().collection('users').findOne({ _id: userId })
  if (!user) {
    res.status(404).json({ error: 'user not found' })
    return null
  }
  return user
}

async function loadTargetOrganization(rawId, res) {
  const organizationId = parseObjectIdOrNull(rawId)
  if (!organizationId) {
    res.status(400).json({ error: 'invalid organization id' })
    return null
  }
  const organization = await getDb().collection('organizations').findOne({ _id: organizationId })
  if (!organization) {
    res.status(404).json({ error: 'organization not found' })
    return null
  }
  return organization
}

// ---- Users ----

router.get('/users', async (_req, res, next) => {
  try {
    const db = getDb()
    const [users, memberships] = await Promise.all([
      db.collection('users').find({}, { projection: { password: 0 } }).sort({ username: 1 }).toArray(),
      db.collection('memberships').find().toArray(),
    ])
    res.json(users.map((user) => toUserRecord(user, memberships)))
  } catch (err) { next(err) }
})

// Creates an account with a temporary password, optionally adding it to any number of organizations
// straight away (memberships: [{ organizationId, role }]).
router.post('/users', async (req, res, next) => {
  try {
    const { username: rawUsername, memberships: rawMemberships = [] } = req.body ?? {}
    const username = typeof rawUsername === 'string' ? rawUsername.trim() : ''
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({ error: 'username must be 1-64 characters of letters, digits, "_", "." or "-"' })
    }

    if (!Array.isArray(rawMemberships)) {
      return res.status(400).json({ error: 'memberships must be an array' })
    }
    const requestedMemberships = new Map()
    for (const entry of rawMemberships) {
      const organizationId = parseObjectIdOrNull(entry?.organizationId)
      if (!organizationId || !ORGANIZATION_ROLES.includes(entry?.role)) {
        return res.status(400).json({ error: `each membership needs a valid organizationId and a role of ${ORGANIZATION_ROLES.join(', ')}` })
      }
      requestedMemberships.set(organizationId.toString(), { organizationId, role: entry.role })
    }

    const db = getDb()
    const requestedOrganizationIds = [...requestedMemberships.values()].map((entry) => entry.organizationId)
    const existingOrganizationCount = await db.collection('organizations').countDocuments({ _id: { $in: requestedOrganizationIds } })
    if (existingOrganizationCount !== requestedOrganizationIds.length) {
      return res.status(404).json({ error: 'one or more organizations were not found' })
    }

    const { temporaryPassword, passwordHash } = await hashTemporaryPassword()
    const userDoc = { username, password: passwordHash, mustChangePassword: true, siteAdmin: false, createdAt: new Date() }
    try {
      userDoc._id = (await db.collection('users').insertOne(userDoc)).insertedId
    } catch (err) {
      if (err?.code === DUPLICATE_KEY_ERROR) {
        return res.status(409).json({ error: `username "${username}" is already taken` })
      }
      throw err
    }

    const memberships = [...requestedMemberships.values()].map(({ organizationId, role }) => ({
      userId: userDoc._id,
      organizationId,
      role,
      createdAt: new Date(),
    }))
    if (memberships.length > 0) {
      await db.collection('memberships').insertMany(memberships)
    }

    res.status(201).json({ user: toUserRecord(userDoc, memberships), temporaryPassword })
  } catch (err) { next(err) }
})

router.patch('/users/:userId', async (req, res, next) => {
  try {
    const { siteAdmin } = req.body ?? {}
    if (typeof siteAdmin !== 'boolean') {
      return res.status(400).json({ error: 'siteAdmin must be a boolean' })
    }

    const user = await loadTargetUser(req, res, { forbidSelf: 'you cannot change your own site admin status' })
    if (!user) return

    await getDb().collection('users').updateOne({ _id: user._id }, { $set: { siteAdmin } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const user = await loadTargetUser(req, res, { forbidSelf: 'you cannot reset your own password here' })
    if (!user) return

    const { temporaryPassword, passwordHash } = await hashTemporaryPassword()
    await getDb().collection('users').updateOne(
      { _id: user._id },
      { $set: { password: passwordHash, mustChangePassword: true } },
    )
    destroySessionsForUser(user._id.toString())
    res.json({ temporaryPassword })
  } catch (err) { next(err) }
})

// Shifts and publish requests keep the deleted username in their history fields.
router.delete('/users/:userId', async (req, res, next) => {
  try {
    const user = await loadTargetUser(req, res, { forbidSelf: 'you cannot delete your own account' })
    if (!user) return

    const db = getDb()
    await db.collection('memberships').deleteMany({ userId: user._id })
    await db.collection('users').deleteOne({ _id: user._id })
    destroySessionsForUser(user._id.toString())
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ---- Organizations ----

router.get('/organizations', async (_req, res, next) => {
  try {
    const docs = await getDb().collection('organizations').find().sort({ name: 1 }).toArray()
    res.json(docs.map(toOrganizationRecord))
  } catch (err) { next(err) }
})

router.post('/organizations', async (req, res, next) => {
  try {
    const name = normalizeOrganizationName(req.body?.name)
    const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : ''
    if (!name) {
      return res.status(400).json({ error: `name is required (max ${MAX_NAME_LENGTH} characters)` })
    }
    if (!SLUG_PATTERN.test(slug) || slug.length > 64) {
      return res.status(400).json({ error: 'slug must be lowercase letters and digits separated by single dashes (max 64 characters)' })
    }

    const doc = { name, slug, createdAt: new Date() }
    try {
      doc._id = (await getDb().collection('organizations').insertOne(doc)).insertedId
    } catch (err) {
      if (err?.code === DUPLICATE_KEY_ERROR) {
        return res.status(409).json({ error: `slug "${slug}" is already in use` })
      }
      throw err
    }
    res.status(201).json(toOrganizationRecord(doc))
  } catch (err) { next(err) }
})

router.patch('/organizations/:organizationId', async (req, res, next) => {
  try {
    const name = normalizeOrganizationName(req.body?.name)
    if (!name) {
      return res.status(400).json({ error: `name is required (max ${MAX_NAME_LENGTH} characters)` })
    }

    const organization = await loadTargetOrganization(req.params.organizationId, res)
    if (!organization) return

    await getDb().collection('organizations').updateOne({ _id: organization._id }, { $set: { name } })
    res.json(toOrganizationRecord({ ...organization, name }))
  } catch (err) { next(err) }
})

// Adds the user to the organization, or changes their role if they are already a member.
router.put('/organizations/:organizationId/members/:userId', async (req, res, next) => {
  try {
    const { role } = req.body ?? {}
    if (!ORGANIZATION_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${ORGANIZATION_ROLES.join(', ')}` })
    }

    const organization = await loadTargetOrganization(req.params.organizationId, res)
    if (!organization) return
    const user = await loadTargetUser(req, res)
    if (!user) return

    await getDb().collection('memberships').updateOne(
      { userId: user._id, organizationId: organization._id },
      { $set: { role }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.delete('/organizations/:organizationId/members/:userId', async (req, res, next) => {
  try {
    const organizationId = parseObjectIdOrNull(req.params.organizationId)
    const userId = parseObjectIdOrNull(req.params.userId)
    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'invalid organization or user id' })
    }

    const result = await getDb().collection('memberships').deleteOne({ userId, organizationId })
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'membership not found' })
    }
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
