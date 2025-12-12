import { Router } from "express";
import * as adminController from "./admin.controller";
import {
    processRedemptionSchema,
    collectDueSchema,
    updateSettingSchema,
    createAdminSchema,
    updateUserStatusSchema,
    manualUserUpdateSchema,
    adjustBalanceSchema,
    adminCreateKioskSchema,
    updateKioskStatusSchema,
    reassignWorkerSchema
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

// ============================================================================
// OWNER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/workers
 * List workers with filters.
 */
router.get("/workers", adminController.getWorkers);

/**
 * GET /api/admin/workers/:id
 * Get worker details.
 */
router.get("/workers/:id", adminController.getWorkerDetails);

/**
 * PUT /api/admin/workers/:id/status
 * Freeze/Ban worker.
 */
router.put(
    "/workers/:id/status",
    validateRequest(updateUserStatusSchema),
    adminController.updateWorkerStatus
);

/**
 * PUT /api/admin/workers/:id/reassign
 * Reassign worker to another kiosk.
 */
router.put(
    "/workers/:id/reassign",
    validateRequest(reassignWorkerSchema),
    adminController.reassignWorker
);

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/customers
 * List customers.
 */
router.get("/customers", adminController.getCustomers);

/**
 * GET /api/admin/customers/:id
 * Get customer details.
 */
router.get("/customers/:id", adminController.getCustomerDetails);

/**
 * PUT /api/admin/customers/:id/status
 * Freeze/Ban customer.
 */
router.put(
    "/customers/:id/status",
    validateRequest(updateUserStatusSchema),
    adminController.updateCustomerStatus
);

// ============================================================================
// EXISTING ROUTES
// ============================================================================
// ============================================================================

/**
 * GET /api/admin/owners
 * List owners with filters.
 */
router.get("/owners", adminController.getOwners);

/**
 * GET /api/admin/owners/:id
 * Get owner details.
 */
router.get("/owners/:id", adminController.getOwnerDetails);

/**
 * PUT /api/admin/owners/:id/status
 * Update owner status (verify/reject/suspend).
 */
router.put(
    "/owners/:id/status",
    validateRequest(updateUserStatusSchema),
    adminController.updateOwnerStatus
);

/**
 * PUT /api/admin/owners/:id
 * Manual update of owner details.
 */
router.put(
    "/owners/:id",
    adminRoleGuard("SUPER_ADMIN", "EDITOR"),
    validateRequest(manualUserUpdateSchema),
    adminController.updateOwner
);

/**
 * POST /api/admin/owners/:id/balance
 * Adjust owner balance.
 */
router.post(
    "/owners/:id/balance",
    adminRoleGuard("SUPER_ADMIN"),
    validateRequest(adjustBalanceSchema),
    adminController.adjustBalance
);

// ============================================================================
// KIOSK MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/kiosks
 * List kiosks with filters.
 */
router.get("/kiosks", adminController.getKiosks);

/**
 * GET /api/admin/kiosks/:id
 * Get kiosk details.
 */
router.get("/kiosks/:id", adminController.getKioskDetails);

/**
 * POST /api/admin/kiosks
 * Create a kiosk manually.
 */
router.post(
    "/kiosks",
    adminRoleGuard("SUPER_ADMIN"),
    validateRequest(adminCreateKioskSchema),
    adminController.createKiosk
);

/**
 * PUT /api/admin/kiosks/:id/status
 * Freeze/Unfreeze kiosk.
 */
router.put(
    "/kiosks/:id/status",
    validateRequest(updateKioskStatusSchema),
    adminController.updateKioskStatus
);


// ============================================================================
// EXISTING ROUTES
// ============================================================================

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
