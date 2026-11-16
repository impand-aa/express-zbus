import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireOrganization } from '../middleware/requireOrganization.js'
import { requireSiteAdmin } from '../middleware/requireSiteAdmin.js'
import adminRouter from './admin.js'
import authRouter from './auth.js'
import organizationsRouter from './organizations.js'
import publishRequestsRouter from './publishRequests.js'
import referenceModulesRouter from './referenceModules.js'
import shiftsRouter from './shifts.js'

const router = Router()
router.use('/auth', authRouter)
router.use('/admin', requireAuth, requireSiteAdmin, adminRouter)

// Everything below /organizations/:organizationId is scoped to that organization's data; the
// routers read the organization from req.organization (set by requireOrganization).
const organizationScopedRouter = Router()
organizationScopedRouter.use('/publish-requests', publishRequestsRouter)
organizationScopedRouter.use('/reference-modules', referenceModulesRouter)
organizationScopedRouter.use('/shifts', shiftsRouter)

router.use('/organizations/:organizationId', requireAuth, requireOrganization, organizationScopedRouter)
router.use('/organizations', organizationsRouter)

export default router
