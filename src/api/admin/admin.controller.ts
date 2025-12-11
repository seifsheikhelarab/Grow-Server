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
