import { Router } from 'express';
import * as adminController from './admin.controller';
import { authMiddleware, roleGuard } from '../../middlewares/auth.middleware';
import {
  approveKioskSchema,
  processRedemptionSchema,
  collectDueSchema,
} from '../../schemas/validation.schema';
import { validateRequest } from '../../middlewares/validate.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

/**
 * GET /api/admin/dashboard
 * Get admin dashboard with stats
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * GET /api/admin/kiosks/pending
 * Get pending kiosks
 */
router.get('/kiosks/pending', adminController.getPendingKiosks);

/**
 * POST /api/admin/kiosks/approve
 * Approve a kiosk
 */
router.post(
  '/kiosks/approve',
  validateRequest(approveKioskSchema),
  adminController.approveKiosk
);

/**
 * GET /api/admin/redemptions/pending
 * Get pending redemptions
 */
router.get('/redemptions/pending', adminController.getPendingRedemptions);

/**
 * POST /api/admin/redemptions/process
 * Process redemption request
 */
router.post(
  '/redemptions/process',
  validateRequest(processRedemptionSchema),
  adminController.processRedemption
);

/**
 * POST /api/admin/dues/collect
 * Collect a due
 */
router.post(
  '/dues/collect',
  validateRequest(collectDueSchema),
  adminController.collectDue
);

export default router;
