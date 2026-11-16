import { Router } from 'express'
import { getDb } from '../db.js'
import { requireOrganizationAdmin } from '../middleware/requireOrganization.js'
import { parseObjectIdOrNull } from '../organizations.js'

// Mounted under /organizations/:organizationId; every query is filtered by req.organization.id,
// including lookups by _id, so a request id from another organization behaves as not found.
const router = Router()
const PUBLISH_TYPES = ['shift', 'route', 'panel']
const PUBLISH_STATUSES = ['pending', 'complete']

function toPublishRequestRecord(doc) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    objectId: doc.objectId ?? null,
    description: doc.description,
    data: doc.data,
    requester: doc.requester,
    updatedAt: doc.updatedAt,
    status: doc.status,
  }
}

function parsePublishRequestId(rawId, res) {
  const objectId = parseObjectIdOrNull(rawId)
  if (!objectId) {
    res.status(400).json({ error: 'invalid publish request id' })
  }
  return objectId
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await getDb().collection('publishRequests')
      .find({ organizationId: req.organization.id })
      .sort({ updatedAt: -1 })
      .toArray()
    res.json(docs.map(toPublishRequestRecord))
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { type, objectId, description, data } = req.body ?? {}
    if (!PUBLISH_TYPES.includes(type) || typeof description !== 'string' || !description.trim() || typeof data !== 'string' || !data.trim()) {
      return res.status(400).json({ error: `type must be one of ${PUBLISH_TYPES.join(', ')}, and description/data must be non-empty strings` })
    }

    const requiresObjectId = type === 'shift'
    if (requiresObjectId && (typeof objectId !== 'string' || !objectId.trim())) {
      return res.status(400).json({ error: 'objectId is required for shift publish requests' })
    }

    const doc = {
      organizationId: req.organization.id,
      type,
      objectId: requiresObjectId ? objectId.trim() : null,
      description: description.trim(),
      data,
      requester: req.session.username,
      status: 'pending',
      updatedAt: new Date(),
    }
    const result = await getDb().collection('publishRequests').insertOne(doc)
    res.status(201).json(toPublishRequestRecord({ ...doc, _id: result.insertedId }))
  } catch (err) { next(err) }
})

router.patch('/:id', requireOrganizationAdmin, async (req, res, next) => {
  try {
    const requestId = parsePublishRequestId(req.params.id, res)
    if (!requestId) return

    const { status } = req.body ?? {}
    if (!PUBLISH_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${PUBLISH_STATUSES.join(', ')}` })
    }

    const updatedAt = new Date()
    const result = await getDb().collection('publishRequests').findOneAndUpdate(
      { _id: requestId, organizationId: req.organization.id },
      { $set: { status, updatedAt } },
      { returnDocument: 'after' },
    )
    if (!result) {
      return res.status(404).json({ error: 'publish request not found' })
    }

    res.json(toPublishRequestRecord(result))
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const requestId = parsePublishRequestId(req.params.id, res)
    if (!requestId) return

    const filter = { _id: requestId, organizationId: req.organization.id }
    const doc = await getDb().collection('publishRequests').findOne(filter)
    if (!doc) {
      return res.status(404).json({ error: 'publish request not found' })
    }

    const isOwnPendingRequest = doc.requester === req.session.username && doc.status === 'pending'
    if (req.organization.role !== 'admin' && !isOwnPendingRequest) {
      return res.status(403).json({ error: 'only an organization admin or the pending request\'s own requester may delete this request' })
    }

    await getDb().collection('publishRequests').deleteOne(filter)
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
