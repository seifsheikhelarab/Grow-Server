import { Request, Response } from "express";
import * as adminService from "./admin.service";
import { ResponseHandler } from "../../utils/response";
import { asyncHandler } from "../../middlewares/error.middleware";

/**
 * Get admin dashboard stats.
 *
 * @param {Request} req - The Express request object containing filter query param.
 * @param {Response} res - The Express response object.
 */
export const getDashboard = asyncHandler(
    async (req: Request, res: Response) => {
        const filter = (req.query.filter as "1d" | "7d" | "30d") || "7d";

        const stats = await adminService.getDashboardStats(filter);

        ResponseHandler.success(
            res,
            "Dashboard stats retrieved successfully",
            stats
        );
    }
);

/**
 * Get pending redemptions.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getPendingRedemptions = asyncHandler(
    async (req: Request, res: Response) => {
        const redemptions = await adminService.getPendingRedemptions();

        ResponseHandler.success(
            res,
            "Pending redemptions retrieved successfully",
            {
                redemptions
            }
        );
    }
);

/**
 * Process redemption request.
 *
 * @param {Request} req - The Express request object containing reqId, action, and note in body.
 * @param {Response} res - The Express response object.
 */
export const processRedemption = asyncHandler(
    async (req: Request, res: Response) => {
        const { reqId, action, note } = req.body;

        const redemption = await adminService.processRedemption(
            reqId,
            action,
            req,
            res,
            note
        );

        ResponseHandler.success(
            res,
            `Redemption ${action.toLowerCase()}ed successfully`,
            {
                id: redemption.id,
                status: redemption.status,
                user_id: redemption.user_id,
                amount: redemption.amount.toString()
            }
        );
    }
);

/**
 * Collect due.
 *
 * @param {Request} req - The Express request object containing dueId in body.
 * @param {Response} res - The Express response object.
 */
export const collectDue = asyncHandler(async (req: Request, res: Response) => {
    const { dueId } = req.body;

    const due = await adminService.collectDue(dueId, req, res);

    ResponseHandler.success(res, "Due collected successfully", {
        id: due.id,
        amount: due.amount.toString(),
        is_paid: due.is_paid
    });
});

/**
 * Get system settings.
 */
export const getSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await adminService.getSystemSettings();
    ResponseHandler.success(res, "System settings retrieved", settings);
});

/**
 * Update system setting.
 */
export const updateSetting = asyncHandler(
    async (req: Request, res: Response) => {
        const { key, value, description } = req.body;
        // Guaranteed by authMiddleware
        const adminId = req.user!.id;
        const setting = await adminService.updateSystemSetting(
            key,
            value,
            adminId,
            description
        );
        ResponseHandler.success(res, "Setting updated", setting);
    }
);

/**
 * List admins.
 */
export const getAdmins = asyncHandler(async (req: Request, res: Response) => {
    const admins = await adminService.getAllAdmins();
    ResponseHandler.success(res, "Admins retrieved", admins);
});

/**
 * Create admin.
 */
export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { phone, fullName, password, adminRole } = req.body;
    const creatorId = req.user!.id;
    const newAdmin = await adminService.createAdminUser(
        phone,
        fullName,
        password,
        adminRole,
        creatorId,
        req,
        res
    );
    if (newAdmin) {
        ResponseHandler.created(res, "Admin created", newAdmin);
    }
});

// ============================================================================
// OWNER CONTROLLERS
// ============================================================================

export const getOwners = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const owners = await adminService.getOwners(filters);
    ResponseHandler.success(res, "Owners retrieved", owners);
});

export const getOwnerDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const owner = await adminService.getOwnerDetails(id);
    ResponseHandler.success(res, "Owner details retrieved", owner);
});

export const updateOwnerStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.updateOwnerStatus(id, status, adminId, note);
    ResponseHandler.success(res, `Owner status updated to ${status}`, updated);
});

export const updateOwner = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.updateOwner(id, data, adminId);
    ResponseHandler.success(res, "Owner details updated", updated);
});

export const adjustBalance = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.adjustBalance(id, amount, reason, adminId);
    ResponseHandler.success(res, "Balance adjusted", updated);
});

// ============================================================================
// KIOSK CONTROLLERS
// ============================================================================

export const getKiosks = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const kiosks = await adminService.getKiosks(filters);
    ResponseHandler.success(res, "Kiosks retrieved", kiosks);
});

export const getKioskDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const kiosk = await adminService.getKioskDetails(id);
    ResponseHandler.success(res, "Kiosk details retrieved", kiosk);
});

export const createKiosk = asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;
    const adminId = req.user!.id;
    const kiosk = await adminService.createKiosk(data, adminId, req, res);
    ResponseHandler.created(res, "Kiosk created", kiosk);
});

export const updateKioskStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { is_active, reason } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.updateKioskStatus(id, is_active, reason, adminId);
    ResponseHandler.success(res, `Kiosk status updated`, updated);
});

// ============================================================================
// WORKER CONTROLLERS
// ============================================================================

export const getWorkers = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const workers = await adminService.getWorkers(filters);
    ResponseHandler.success(res, "Workers retrieved", workers);
});

export const getWorkerDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const worker = await adminService.getWorkerDetails(id);
    ResponseHandler.success(res, "Worker details retrieved", worker);
});

export const updateWorkerStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.updateWorkerStatus(id, status, adminId, note);
    ResponseHandler.success(res, `Worker status updated to ${status}`, updated);
});

export const reassignWorker = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { kioskId } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.reassignWorker(id, kioskId, adminId);
    ResponseHandler.success(res, "Worker reassigned", updated);
});

// ============================================================================
// CUSTOMER CONTROLLERS
// ============================================================================

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const customers = await adminService.getCustomers(filters);
    ResponseHandler.success(res, "Customers retrieved", customers);
});

export const getCustomerDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const customer = await adminService.getCustomerDetails(id);
    ResponseHandler.success(res, "Customer details retrieved", customer);
});

export const updateCustomerStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user!.id;
    const updated = await adminService.updateCustomerStatus(id, status, adminId, note);
    ResponseHandler.success(res, `Customer status updated to ${status}`, updated);
});
