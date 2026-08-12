import { Router } from 'express'
import authRouter from './auth.js'
import publishRequestsRouter from './publishRequests.js'
import referenceModulesRouter from './referenceModules.js'
import shiftsRouter from './shifts.js'

const router = Router()
router.use('/auth', authRouter)
router.use('/publish-requests', publishRequestsRouter)
router.use('/reference-modules', referenceModulesRouter)
router.use('/shifts', shiftsRouter)

export default router
