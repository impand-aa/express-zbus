import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
const MODULE_TYPES = ['routes', 'panels', 'nums', 'sounds']

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await getDb().collection('referenceModules').find({ type: { $in: MODULE_TYPES } }).toArray()
    const sources = { routesSource: '', panelsSource: '', numsSource: '', soundsSource: '' }
    for (const doc of docs) {
      sources[`${doc.type}Source`] = doc.source
    }
    res.json(sources)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.session.rank !== 'admin') {
      return res.status(403).json({ error: 'admin rank required' })
    }

    const { type, source } = req.body ?? {}
    if (!MODULE_TYPES.includes(type) || typeof source !== 'string') {
      return res.status(400).json({ error: `type must be one of ${MODULE_TYPES.join(', ')} and source must be a string` })
    }

    await getDb().collection('referenceModules').updateOne(
      { type },
      { $set: { source, updatedAt: new Date() } },
      { upsert: true },
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
