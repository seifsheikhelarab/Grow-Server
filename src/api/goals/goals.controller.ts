import { Request, Response } from "express";
import { setWorkerGoal, getKioskGoal, getGoalWorker } from "./goals.service.js";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler, errorHandler } from "../../middlewares/error.middleware.js";

/**
 * Set a goal for a worker.
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
 * Get a goal for a worker.
 */
export const getGoal = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { kioskId } = req.params;
        const ownerId = req.user.id;


        const goals = await getKioskGoal(kioskId, ownerId, req, res); // Fixed argument order: kioskId first

        if (res.headersSent) return null;

        return ResponseHandler.success(res, "Goal retrieved", goals);
    } catch (error) {
        errorHandler(error, req, res);
        if (res.headersSent) return null;
        return ResponseHandler.error(res, "Failed to retrieve goal", error);
    }
});


/**
 * Get a goal for a worker.
 */
export const getWorkerStatus = asyncHandler(async (req: Request, res: Response) => {
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
});

