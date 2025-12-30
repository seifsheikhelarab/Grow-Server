import prisma from "../../prisma.js";
import {
    NotFoundError,
    BusinessLogicError,
    ErrorCode,
    AppError
} from "../../utils/response.js";
import logger from "../../utils/logger.js";
import { errorHandler } from "../../middlewares/error.middleware.js";
import { Request, Response } from "express";
import { Goal } from "@prisma/client";
import * as notificationService from "../notifications/notifications.service.js";

/**
 * Constants for transaction limits
 */
const REDEMPTION_FEE = 5;
const MIN_REDEMPTION_AMOUNT = 10;

/**
 * Get user's wallet balance.
 *
 * @param {string} userId - The ID of the user.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<number>} The wallet balance.
 */
export async function getBalance(userId: string, req: Request, res: Response) {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });

        if (!wallet) {
            errorHandler(new NotFoundError("Wallet not found"), req, res);
        }

        return wallet.balance.toNumber
            ? wallet.balance.toNumber()
            : Number(wallet.balance);
    } catch (err) {
        logger.error(`Error getting balance: ${err}`);
        errorHandler(
            new AppError(
                "Error getting balance",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return 0;
    }
}

/**
 * Deduct points from wallet.
 *
 * @param {string} userId - The ID of the user.
 * @param {number} amount - The amount to deduct.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<void>}
 */
export async function deductPoints(
    userId: string,
    amount: number,
    req: Request,
    res: Response
): Promise<void> {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });

        if (!wallet) {
            errorHandler(new NotFoundError("Wallet not found"), req, res);
        }

        if (wallet.balance.toNumber() < amount) {
            errorHandler(
                new BusinessLogicError(
                    `Insufficient balance. Required: ${amount}, Available: ${wallet.balance}`,
                    ErrorCode.INSUFFICIENT_BALANCE,
                    { required: amount, available: wallet.balance }
                ),
                req,
                res
            );
        }

        await prisma.wallet.update({
            where: { user_id: userId },
            data: { balance: { decrement: amount } }
        });

        logger.info(`Deducted ${amount} points from user ${userId}`);
    } catch (err) {
        logger.error(`Error deducting points: ${err}`);
        errorHandler(
            new AppError(
                "Error deducting points",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
    }
}

/**
 * Add points to wallet.
 *
 * @param {string} userId - The ID of the user.
 * @param {number} amount - The amount to add.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<void>}
 */
export async function addPoints(
    userId: string,
    amount: number,
    req: Request,
    res: Response
): Promise<void> {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });

        if (!wallet) {
            errorHandler(new NotFoundError("Wallet not found"), req, res);
        }

        await prisma.wallet.update({
            where: { user_id: userId },
            data: { balance: { increment: amount } }
        });

        logger.info(`Added ${amount} points to user ${userId}`);
    } catch (err) {
        logger.error(`Error adding points: ${err}`);
        errorHandler(
            new AppError("Error adding points", 500, ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
    }
}

/**
 * Create redemption request.
 *
 * @param {string} userId - The ID of the user.
 * @param {number} amount - The amount to redeem.
 * @param {string} method - The redemption method.
 * @param {string} type - The redemption type.
 * @param {string} details - The redemption details.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The redemption request.
 */
export async function createRedemption(
    userId: string,
    amount: number,
    method: string,
    type: string,
    details: string,
    req: Request,
    res: Response
) {
    try {
        if (amount < MIN_REDEMPTION_AMOUNT) {
            errorHandler(
                new BusinessLogicError(
                    `Redemption amount must be at least ${MIN_REDEMPTION_AMOUNT}`,
                    ErrorCode.INVALID_AMOUNT
                ),
                req,
                res
            );
        }

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });

        if (!wallet) {
            errorHandler(new NotFoundError("Wallet not found"), req, res);
        }

        if (wallet.balance.toNumber() < amount) {
            errorHandler(
                new BusinessLogicError(
                    `Insufficient balance for redemption. Required: ${amount}, Available: ${wallet.balance}`,
                    ErrorCode.INSUFFICIENT_BALANCE
                ),
                req,
                res
            );
        }

        // Create redemption request within transaction
        const redemption = await prisma.$transaction(async (tx) => {
            // Deduct points immediately
            await tx.wallet.update({
                where: { user_id: userId },
                data: { balance: { decrement: amount + REDEMPTION_FEE } }
            });

            // Create redemption request
            return await tx.redemptionRequest.create({
                data: {
                    user_id: userId,
                    amount: amount,
                    type,
                    method,
                    details,
                    status: "PENDING"
                }
            });
        });

        logger.info(
            `Redemption request created: ${redemption.id} for ${amount} points`
        );

        // Get user info for notifications
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { full_name: true, role: true }
        });

        // Notify the worker/customer that their request was submitted
        await notificationService.notifyWorkerRedemptionCreated(
            userId,
            amount.toString()
        );

        // If worker, notify their kiosk owner(s)
        if (user?.role === "WORKER") {
            const workerProfiles = await prisma.workerProfile.findMany({
                where: { user_id: userId },
                include: { kiosk: true }
            });

            for (const profile of workerProfiles) {
                if (profile.kiosk) {
                    await notificationService.notifyOwnerWorkerRedemption(
                        profile.kiosk.owner_id,
                        user.full_name,
                        amount.toString()
                    );
                }
            }
        }

        return redemption;
    } catch (err) {
        logger.error(`Error creating redemption: ${err}`);
        errorHandler(
            new AppError(
                "Error creating redemption",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return null;
    }
}

/**
 * Create goal.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} title - The title of the goal.
 * @param {number} target_amount - The target amount of the goal.
 * @param {string} type - The type of the goal.
 * @param {Date} [deadline] - The deadline of the goal.
 * @returns {Promise<object>} The created goal.
 */
export async function createGoal(
    userId: string,
    title: string,
    target_amount: number,
    type: string,
    kiosk_id: string,
    req: Request,
    res: Response,
    deadline?: Date
) {
    try {
        if (type === "WORKER_TARGET" && target_amount > 500) {
            errorHandler(
                new BusinessLogicError(
                    "Worker target goal cannot exceed 500 points",
                    ErrorCode.INVALID_AMOUNT
                ),
                req,
                res
            );
        }

        const goal = await prisma.goal.create({
            data: {
                user_id: userId,
                title,
                target_amount: target_amount,
                type,
                deadline,
                kiosk_id
            }
        });

        logger.info(`Goal created: ${goal.id} for user ${userId}`);
        return goal;
    } catch (err) {
        logger.error(`Error creating goal: ${err}`);
        errorHandler(
            new AppError("Error creating goal", 500, ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
        return null;
    }
}

/**
 * Get user's goals with dynamic progress calculation.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object[]>} List of goals.
 */
export async function getGoals(userId: string, req: Request, res: Response) {
    try {
        const goals = await prisma.goal.findMany({
            where: { user_id: userId },
            orderBy: { deadline: "asc" }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) {
            errorHandler(new NotFoundError("User not found"), req, res);
            return null;
        }

        const goalsWithProgress = await Promise.all(
            goals.map(async (goal) => {
                let currentAmount = 0;
                const deadline = goal.deadline || new Date();

                if (goal.type === "SAVING") {
                    // Customer saving goal: Sum of deposits received
                    const aggregate = await prisma.transaction.aggregate({
                        _sum: { amount_net: true },
                        where: {
                            receiver_id: userId,
                            type: "DEPOSIT",
                            created_at: {
                                gte: goal.created_at,
                                lte: deadline
                            }
                        }
                    });
                    currentAmount = aggregate._sum.amount_net?.toNumber() || 0;
                } else if (goal.type === "WORKER_TARGET") {
                    if (user.role === "WORKER") {
                        // Worker target: Sum of commission earned from sent transactions
                        const aggregate = await prisma.transaction.aggregate({
                            _sum: { commission: true },
                            where: {
                                sender_id: userId,
                                type: "DEPOSIT", // Commission earned on deposits
                                created_at: {
                                    gte: goal.created_at,
                                    lte: deadline
                                }
                            }
                        });
                        currentAmount =
                            aggregate._sum.commission?.toNumber() || 0;
                    } else if (user.role === "OWNER") {
                        // Owner target: Sum of commission earned by their kiosks
                        const aggregate = await prisma.transaction.aggregate({
                            _sum: { commission: true },
                            where: {
                                kiosk: { owner_id: userId },
                                type: "DEPOSIT",
                                created_at: {
                                    gte: goal.created_at,
                                    lte: deadline
                                }
                            }
                        });
                        currentAmount =
                            aggregate._sum.commission?.toNumber() || 0;
                    }
                }

                return {
                    ...goal,
                    current_amount: currentAmount
                };
            })
        );

        return goalsWithProgress;
    } catch (err) {
        logger.error(`Error getting goals: ${err}`);
        errorHandler(err, req, res);
        return null;
    }
}

/**
 * Edit owner's goal.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} id - The ID of the goal.
 * @param {string} title - The title of the goal.
 * @param {number} target - The target amount of the goal.
 * @param {string} type - The type of the goal.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {Date} deadline - The deadline of the goal.
 * @returns {Promise<void>}
 */
export async function editGoal(
    userId: string,
    id: string,
    title: string,
    target: number,
    type: string,
    req: Request,
    res: Response,
    deadline: Date | undefined
): Promise<Goal> {
    try {
        const goal = await prisma.goal.findUnique({
            where: { id }
        });

        if (!goal) {
            errorHandler(new NotFoundError("Goal not found"), req, res);
        }

        if (goal.owner_id !== userId) {
            errorHandler(
                new BusinessLogicError(
                    "You are not authorized to edit this goal",
                    ErrorCode.UNAUTHORIZED_ACCESS
                ),
                req,
                res
            );
        }

        logger.info(`Edited goal ${id} for user ${userId}`);
        return await prisma.goal.update({
            where: { id },
            data: { title, target_amount: target, type, deadline }
        });
    } catch (err) {
        logger.error(`Error editing goal: ${err}`);
        errorHandler(err, req, res);
        return null;
    }
}
