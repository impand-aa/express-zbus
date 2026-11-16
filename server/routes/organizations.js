import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { listUserOrganizations } from '../organizations.js'

const router = Router()

// The organizations the signed-in user can access, with their role in each.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await listUserOrganizations(req.session.userId))
  } catch (err) { next(err) }
})

export default router
