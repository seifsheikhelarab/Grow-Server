import { Request, Response } from "express";
import { setWorkerGoal, getWorkerGoal } from "./goals.service.js";
import { ResponseHandler } from "../../utils/response.js";

/**
 * Set a goal for a worker.
 */
export async function setGoal(req: Request, res: Response) {
    const { workerId, targetAmount } = req.body;
    // Assume owner is authenticated and their ID is in req.user.id
    const ownerId = req.user.id;

    const goal = await setWorkerGoal(
        ownerId,
        workerId,
        Number(targetAmount),
        req,
        res
    );
    ResponseHandler.success(res, "Goal set successfully", goal);
}

/**
 * Get a goal for a worker.
 */
export async function getGoal(req: Request, res: Response) {
    const { workerId } = req.params;
    const goal = await getWorkerGoal(workerId);
    ResponseHandler.success(res, "Goal retrieved", goal);
}
