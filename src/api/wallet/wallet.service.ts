import prisma from "../../prisma";
import {
    NotFoundError,
    BusinessLogicError,
    ErrorCode
} from "../../utils/response";
import logger from "../../utils/logger";
import { errorHandler } from "../../middlewares/error.middleware";
import { Request, Response } from "express";

/**
 * Get user's wallet balance
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
        throw err;
    }
}

/**
 * Get wallet details
 */
export async function getWalletDetails(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
            include: {
                user: {
                    select: {
                        id: true,
                        phone: true,
                        role: true
                    }
                }
            }
        });

        if (!wallet) {
            errorHandler(new NotFoundError("Wallet not found"), req, res);
        }

        return {
            id: wallet.id,
            user_id: wallet.user_id,
            balance: wallet.balance.toNumber
                ? wallet.balance.toNumber()
                : Number(wallet.balance),
            user: wallet.user
        };
    } catch (err) {
        logger.error(`Error getting wallet details: ${err}`);
        throw err;
    }
}

/**
 * Deduct points from wallet
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
        throw err;
    }
}

/**
 * Add points to wallet
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
        throw err;
    }
}

/**
 * Create redemption request
 */
export async function createRedemption(
    userId: string,
    amount: number,
    method: string,
    details: string,
    req: Request,
    res: Response
) {
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
                data: { balance: { decrement: amount } }
            });

            // Create redemption request
            return await tx.redemptionRequest.create({
                data: {
                    user_id: userId,
                    amount: amount,
                    method,
                    details,
                    status: "PENDING"
                }
            });
        });

        logger.info(
            `Redemption request created: ${redemption.id} for ${amount} points`
        );
        return redemption;
    } catch (err) {
        logger.error(`Error creating redemption: ${err}`);
        throw err;
    }
}

/**
 * Create goal
 */
export async function createGoal(
    userId: string,
    title: string,
    target_amount: number,
    type: string,
    deadline?: Date
) {
    try {
        const goal = await prisma.goal.create({
            data: {
                user_id: userId,
                title,
                target_amount: target_amount,
                type,
                deadline
            }
        });

        logger.info(`Goal created: ${goal.id} for user ${userId}`);
        return goal;
    } catch (err) {
        logger.error(`Error creating goal: ${err}`);
        throw err;
    }
}

/**
 * Get user's goals
 */
export async function getGoals(userId: string) {
    try {
        const goals = await prisma.goal.findMany({
            where: { user_id: userId },
            orderBy: { deadline: "asc" }
        });

        return goals;
    } catch (err) {
        logger.error(`Error getting goals: ${err}`);
        throw err;
    }
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
    goalId: string,
    amount: number,
    req: Request,
    res: Response
) {
    try {
        const goal = await prisma.goal.findUnique({
            where: { id: goalId }
        });

        if (!goal) {
            errorHandler(new NotFoundError("Goal not found"), req, res);
        }

        const updated = await prisma.goal.update({
            where: { id: goalId },
            data: {
                current_amount: { increment: amount }
            }
        });

        logger.info(`Goal ${goalId} progress updated by ${amount}`);
        return updated;
    } catch (err) {
        logger.error(`Error updating goal: ${err}`);
        throw err;
    }
}
