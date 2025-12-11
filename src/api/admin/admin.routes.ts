import { Router } from "express";
import * as adminController from "./admin.controller";
import {
    processRedemptionSchema,
    collectDueSchema,
    updateSettingSchema,
    createAdminSchema
} from "../../schemas/validation.schema";
import {
    authMiddleware,
    roleGuard,
    adminRoleGuard
} from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleGuard("ADMIN"));

/**
 * GET /api/admin/dashboard
 * Get admin dashboard with stats.
 */
router.get("/dashboard", adminController.getDashboard);

/**
 * GET /api/admin/redemptions/pending
 * Get pending redemptions.
 */
router.get("/redemptions/pending", adminController.getPendingRedemptions);

/**
 * POST /api/admin/redemptions/process
 * Process redemption request.
 */
router.post(
    "/redemptions/process",
    validateRequest(processRedemptionSchema),
    adminController.processRedemption
);

/**
 * POST /api/admin/dues/collect
 * Collect a due.
 */
router.post(
    "/dues/collect",
    validateRequest(collectDueSchema),
    adminController.collectDue
);

/**
 * GET /api/admin/settings
 * Get system settings.
 */
router.get(
    "/settings",
    adminRoleGuard("SUPER_ADMIN", "EDITOR", "VIEWER"),
    adminController.getSettings
);

/**
 * PUT /api/admin/settings/update
 * Update system setting (Super Admin).
 */
router.put(
    "/settings",
    adminRoleGuard("SUPER_ADMIN"),
    validateRequest(updateSettingSchema),
    adminController.updateSetting
);

/**
 * GET /api/admin/team
 * List admin team members (Super Admin).
 */
router.get("/team", adminRoleGuard("SUPER_ADMIN"), adminController.getAdmins);

/**
 * POST /api/admin/team/create
 * Create new admin (Super Admin).
 */
router.post(
    "/team",
    adminRoleGuard("SUPER_ADMIN"),
    validateRequest(createAdminSchema),
    adminController.createAdmin
);

export default router;
