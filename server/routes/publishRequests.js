import { ObjectId } from 'mongodb'
import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

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

function parseObjectId(rawId, res) {
  try {
    return new ObjectId(rawId)
  } catch {
    res.status(400).json({ error: 'invalid publish request id' })
    return null
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await getDb().collection('publishRequests').find().sort({ updatedAt: -1 }).toArray()
    res.json(docs.map(toPublishRequestRecord))
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req, res, next) => {
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

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.session.rank !== 'admin') {
      return res.status(403).json({ error: 'admin rank required' })
    }

    const objectId = parseObjectId(req.params.id, res)
    if (!objectId) return

    const { status } = req.body ?? {}
    if (!PUBLISH_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${PUBLISH_STATUSES.join(', ')}` })
    }

    const updatedAt = new Date()
    const result = await getDb().collection('publishRequests').findOneAndUpdate(
      { _id: objectId },
      { $set: { status, updatedAt } },
      { returnDocument: 'after' },
    )
    if (!result) {
      return res.status(404).json({ error: 'publish request not found' })
    }

    res.json(toPublishRequestRecord(result))
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const objectId = parseObjectId(req.params.id, res)
    if (!objectId) return

    const doc = await getDb().collection('publishRequests').findOne({ _id: objectId })
    if (!doc) {
      return res.status(404).json({ error: 'publish request not found' })
    }

    const isOwnPendingRequest = doc.requester === req.session.username && doc.status === 'pending'
    if (req.session.rank !== 'admin' && !isOwnPendingRequest) {
      return res.status(403).json({ error: 'only an admin or the pending request\'s own requester may delete this request' })
    }

    await getDb().collection('publishRequests').deleteOne({ _id: objectId })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
