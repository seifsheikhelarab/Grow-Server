import { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";
import { ResponseHandler } from "../../utils/response";
import { asyncHandler } from "../../middlewares/error.middleware";

/**
 * Get Owner Dashboard.
 * 
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getOwnerDashboard = asyncHandler(async (req: Request, res: Response) => {
    // Assumes auth middleware populates req.user
    const userId = req.user?.id;

    // Safety check mostly for TS, middleware should catch unauthed
    if (!userId) {
        throw new Error("User ID not found in request");
    }

    const data = await dashboardService.getOwnerDashboard(userId);

    ResponseHandler.success(res, "Owner dashboard data retrieved successfully", data);
});

/**
 * Get Worker Dashboard.
 * 
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerDashboard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new Error("User ID not found in request");
    }

    const data = await dashboardService.getWorkerDashboard(userId);

    ResponseHandler.success(res, "Worker dashboard data retrieved successfully", data);
});
