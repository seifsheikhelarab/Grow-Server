import { Request, Response } from "express";
import {
    setWorkerGoal,
    getKioskGoal,
    getGoalWorker,
    getKioskGoals
} from "./goals.service.js";
import { ResponseHandler } from "../../utils/response.js";
import {
    asyncHandler,
    errorHandler
} from "../../middlewares/error.middleware.js";

/**
 * Set a goal for a worker.
 * @param {Request} req - The Express request object containing workerId and targetAmount in body.
 * @param {Response} res - The Express response object.
 */
export const setGoal = asyncHandler(async (req: Request, res: Response) => {
    const { workerId, targetAmount } = req.body;
    const ownerId = req.user.id;

    const goal = await setWorkerGoal(
        ownerId,
        workerId,
        Number(targetAmount),
        req,
        res
    );
    if (res.headersSent) return null;
    return ResponseHandler.success(res, "Goal set successfully", goal);
});

/**
 * Get goals for a kiosk.
 * @param {Request} req - The Express request object containing kioskId in params.
 * @param {Response} res - The Express response object.
 */
export const getGoal = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { kioskId } = req.params;
        const ownerId = req.user.id;

        const goals = await getKioskGoal(kioskId, ownerId, req, res);
        const total = await getKioskGoals(kioskId, req, res);

        if (res.headersSent) return null;

        return ResponseHandler.success(res, "Goal retrieved", { total, goals });
    } catch (error) {
        errorHandler(error, req, res);
        if (res.headersSent) return null;
        return ResponseHandler.error(res, "Failed to retrieve goal", error);
    }
});

/**
 * Get status of worker's goal.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerStatus = asyncHandler(
    async (req: Request, res: Response) => {
        try {
            const workerId = req.user.id;

            const goals = await getGoalWorker(workerId, req, res);

            if (res.headersSent) return null;

            return ResponseHandler.success(res, "Goal retrieved", goals);
        } catch (error) {
            errorHandler(error, req, res);
            if (res.headersSent) return null;
            return ResponseHandler.error(res, "Failed to retrieve goal", error);
        }
    }
);
