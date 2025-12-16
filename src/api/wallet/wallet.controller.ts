import { Request, Response } from "express";
import * as walletService from "./wallet.service.js";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

/**
 * Get wallet balance.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getBalance = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const balance = await walletService.getBalance(userId, req, res);

    ResponseHandler.success(res, "Balance retrieved successfully", {
        balance: balance.toString()
    });
});

// /**
//  * Get wallet details.
//  *
//  * @param {Request} req - The Express request object.
//  * @param {Response} res - The Express response object.
//  */
// export const getWalletDetails = asyncHandler(
//     async (req: Request, res: Response) => {
//         const userId = req.user!.id;

//         const wallet = await walletService.getWalletDetails(userId, req, res);

//         ResponseHandler.success(
//             res,
//             "Wallet details retrieved successfully",
//             wallet
//         );
//     }
// );

/**
 * Create redemption request.
 *
 * @param {Request} req - The Express request object containing amount, method, and details in body.
 * @param {Response} res - The Express response object.
 */
export const redeem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { amount, method, details } = req.body;

    const redemption = await walletService.createRedemption(
        userId,
        amount,
        method,
        details,
        req,
        res
    );

    ResponseHandler.created(res, "Redemption request created successfully", {
        id: redemption.id,
        amount: redemption.amount.toString(),
        method: redemption.method,
        status: redemption.status,
        created_at: redemption.created_at
    });
});

/**
 * Create goal.
 *
 * @param {Request} req - The Express request object containing title, target, type, and deadline in body.
 * @param {Response} res - The Express response object.
 */
export const createGoal = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { title, target, type, deadline } = req.body;

    const goal = await walletService.createGoal(
        userId,
        title,
        target,
        type,
        req,
        res,
        deadline ? new Date(deadline) : undefined
    );

    ResponseHandler.created(res, "Goal created successfully", {
        id: goal.id,
        title: goal.title,
        target_amount: goal.target_amount.toString(),
        current_amount: goal.current_amount.toString(),
        type: goal.type,
        deadline: goal.deadline
    });
});

/**
 * Get user's goals.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getGoals = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const goals = await walletService.getGoals(userId);

    ResponseHandler.success(res, "Goals retrieved successfully", {
        goals: goals.map((g) => ({
            id: g.id,
            title: g.title,
            target_amount: g.target_amount.toString(),
            current_amount: g.current_amount.toString(),
            type: g.type,
            progress_percentage: (
                (Number(g.current_amount) / Number(g.target_amount)) *
                100
            ).toFixed(2),
            deadline: g.deadline
        }))
    });
});

/**
 * Update goal progress.
 *
 * @param {Request} req - The Express request object containing id in params and amount in body.
 * @param {Response} res - The Express response object.
 */
export const updateGoalProgress = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { amount } = req.body;

        const updated = await walletService.updateGoalProgress(
            id,
            amount,
            req,
            res
        );

        ResponseHandler.success(res, "Goal progress updated successfully", {
            id: updated.id,
            current_amount: updated.current_amount.toString(),
            target_amount: updated.target_amount.toString(),
            progress_percentage: (
                Number(updated.current_amount) / Number(updated.target_amount)
            ).toFixed(2)
        });
    }
);
