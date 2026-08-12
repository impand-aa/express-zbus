import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

function toShiftRecord(doc) {
  return {
    moduleName: doc.moduleName,
    source: doc.source,
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt,
  }
}

// Bulk read, used to keep the Overview tab in sync with every shift on the server.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await getDb().collection('shifts').find().toArray()
    res.json(docs.map(toShiftRecord))
  } catch (err) { next(err) }
})

router.get('/:moduleName', requireAuth, async (req, res, next) => {
  try {
    const doc = await getDb().collection('shifts').findOne({ moduleName: req.params.moduleName })
    if (!doc) {
      return res.status(404).json({ error: 'shift not found' })
    }
    res.json(toShiftRecord(doc))
  } catch (err) { next(err) }
})

router.put('/:moduleName', requireAuth, async (req, res, next) => {
  try {
    const moduleName = req.params.moduleName.trim()
    const { source } = req.body ?? {}
    if (!moduleName || typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ error: 'moduleName and source are required' })
    }

    const updatedAt = new Date()
    const updatedBy = req.session.username
    await getDb().collection('shifts').updateOne(
      { moduleName },
      { $set: { moduleName, source, updatedBy, updatedAt } },
      { upsert: true },
    )
    res.json({ moduleName, source, updatedBy, updatedAt })
  } catch (err) { next(err) }
})

export default router
