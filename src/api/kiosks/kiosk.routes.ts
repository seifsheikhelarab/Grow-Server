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
 * POST /api/kiosks/
 * Create new kiosk (Owner only)
 */
/**
 * GET /api/kiosks/
 * Get user's kiosks
 */
router.route('/').post(
  roleGuard('OWNER'),
  validateRequest(createKioskSchema),
  kioskController.create
).get(roleGuard('OWNER'), kioskController.getUserKiosks);

/**
 * POST /api/kiosks/invite-worker
 * Invite worker to kiosk (Owner only)
 */
router.route('/invite-worker').post(
  roleGuard('OWNER'),
  validateRequest(inviteWorkerSchema),
  kioskController.inviteWorker
);

/**
 * GET /api/kiosks/worker-invitations
 * Get kiosk invitations (Worker only)
 */
router.route('/worker-invitations').get(roleGuard('WORKER'), kioskController.getWorkerInvitations);

/**
 * POST /api/kiosks/accept-invitation
 * Accept worker invitation (Worker only)
 */
router.route('/accept-invitation').post(
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
