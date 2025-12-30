import { Request, Response } from "express";
import * as profileService from "./profile.service.js";
import { BusinessLogicError, ErrorCode, ResponseHandler } from "../../utils/response.js";
import { asyncHandler, errorHandler } from "../../middlewares/error.middleware.js";

/**
 * Get profile.
 *
 * @param {Request} req - The Express request object containing kioskId in params.
 * @param {Response} res - The Express response object.
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const profile = await profileService.getProfile(userId, req, res);

    if (res.headersSent) return;

    ResponseHandler.success(res, "Profile retrieved successfully", {
        profile
    });
});

/**
 * Update profile.
 *
 * @param {Request} req - The Express request object containing full_name in body.
 * @param {Response} res - The Express response object.
 */
export const updateProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { full_name, name } = req.body;

        if (!name && !full_name) {
            errorHandler(new BusinessLogicError("Name is required",ErrorCode.VALIDATION_ERROR),req,res)
        }

        const profile = await profileService.updateProfile(
            userId,
            full_name || name,
            req,
            res
        );

        if (res.headersSent) return;

        ResponseHandler.success(res, "Profile updated successfully", {
            profile
        });
    }
);

/**
 * Get worker profile.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.id;

        const profile = await profileService.getWorkerProfile(userId, req, res);

        if (res.headersSent) return;

        ResponseHandler.success(res, "Profile retrieved successfully", {
            profile
        });
    }
);
