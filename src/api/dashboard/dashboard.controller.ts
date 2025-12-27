import { errorHandler } from "./../../middlewares/error.middleware.js";
import { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

/**
 * Get Owner Dashboard.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getOwnerDashboard = asyncHandler(
    async (req: Request, res: Response) => {
        // Assumes auth middleware populates req.user
        const userId = req.user?.id;

        // Safety check mostly for TS, middleware should catch unauthed
        if (!userId) {
            errorHandler(new Error("User ID not found in request"), req, res);
        }

        const data = await dashboardService.getOwnerDashboard(userId, req, res);

        ResponseHandler.success(
            res,
            "Owner dashboard data retrieved successfully",
            data
        );
    }
);

/**
 * Get Worker Dashboard.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerDashboard = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            errorHandler(new Error("User ID not found in request"), req, res);
        }

        const { workerProfileId } = req.query;

        const data = await dashboardService.getWorkerDashboard(
            userId,
            workerProfileId as string,
            req,
            res
        );

        ResponseHandler.success(
            res,
            "Worker dashboard data retrieved successfully",
            data
        );
    }
);
