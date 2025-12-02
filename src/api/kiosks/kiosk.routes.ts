import { Router } from 'express';
import * as kioskController from './kiosk.controller';
import { authMiddleware, roleGuard } from '../../middlewares/auth.middleware';
import {
  createKioskSchema,
  inviteWorkerSchema,
} from '../../schemas/validation.schema';
import { validateRequest } from '../../middlewares/validate.middleware';

const router = Router();

// All kiosk routes require authentication
router.use(authMiddleware);

/**
 * POST /api/kiosks/create
 * Create new kiosk (Owner only)
 */
router.post(
  '/create',
  roleGuard('OWNER'),
  validateRequest(createKioskSchema),
  kioskController.create
);

/**
 * GET /api/kiosks/list
 * Get user's kiosks
 */
router.get('/list', roleGuard('OWNER'), kioskController.getUserKiosks);

/**
 * POST /api/kiosks/invite-worker
 * Invite worker to kiosk (Owner only)
 */
router.post(
  '/invite-worker',
  roleGuard('OWNER'),
  validateRequest(inviteWorkerSchema),
  kioskController.inviteWorker
);

/**
 * POST /api/kiosks/accept-invitation
 * Accept worker invitation (Worker only)
 */
router.post(
  '/accept-invitation',
  roleGuard('WORKER'),
  kioskController.acceptInvitation
);

/**
 * GET /api/kiosks/:kioskId/workers
 * Get kiosk workers (Owner only)
 */
router.get(
  '/:kioskId/workers',
  roleGuard('OWNER'),
  kioskController.getWorkers
);

/**
 * GET /api/kiosks/:kioskId/dues
 * Get kiosk dues (Owner only)
 */
router.get(
  '/:kioskId/dues',
  roleGuard('OWNER'),
  kioskController.getDues
);

export default router;
