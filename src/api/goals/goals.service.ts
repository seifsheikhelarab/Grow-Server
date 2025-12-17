import { errorHandler } from './../../middlewares/error.middleware.js';
import prisma from "../../prisma.js"; // Adjust path if needed
import { NotFoundError, AuthorizationError } from "../../utils/response.js";
import logger from "../../utils/logger.js";
import { Goal } from "@prisma/client";
import type { Request, Response } from "express";

/**
 * Set a daily recurring goal for a worker.
 * Owner must own the kiosk the worker is assigned to.
 */
export async function setWorkerGoal(
    ownerId: string,
    workerId: string,
    targetAmount: number,
    req: Request,
    res: Response
): Promise<Goal | null> {
    // 1. Verify Owner and Worker relationship
    const workerProfile = await prisma.workerProfile.findUnique({
        where: { user_id: workerId },
        include: { kiosk: true }
    });

    if (!workerProfile) {
        errorHandler(new NotFoundError("Worker not found"), req, res);
        return null;
    }

    if (workerProfile.kiosk.owner_id !== ownerId) {
        errorHandler(new AuthorizationError(
            "You can only set goals for your own workers"
        ), req, res);
        return null;
    }

    // 2. Upsert Goal
    // Strategy: Look for an existing recurring goal for this worker and update it, or create new.
    const existingGoal = await prisma.goal.findFirst({
        where: {
            user_id: workerId,
            is_recurring: true,
            type: "WORKER_TARGET"
        }
    });

    if (existingGoal) {
        const updatedGoal = await prisma.goal.upsert(
            {
                where: { id: existingGoal.id },
                update: {
                    target_amount: targetAmount,
                    owner_id: ownerId
                },
                create: {
                    user_id: workerId,
                    owner_id: ownerId,
                    title: "Daily Commission Target",
                    target_amount: targetAmount,
                    type: "WORKER_TARGET",
                    is_recurring: true,
                    deadline: null // Recurring has no fixed deadline, it happens daily
                }
            });
        return updatedGoal;
    } else {
        return null;
    }
}

/**
 * Get the current active goal for a worker.
 */
export async function getWorkerGoal(workerId: string) {
    return await prisma.goal.findFirst({
        where: {
            user_id: workerId,
            is_recurring: true,
            type: "WORKER_TARGET"
        }
    });
}

/**
 * Core Logic: Check Daily Goals.
 * Should be run at the end of the day (e.g. 23:59).
 */
export async function checkDailyGoals() {
    logger.info("[Goals] Starting daily goal check...");

    // 1. Get all active recurring goals
    const goals = await prisma.goal.findMany({
        where: {
            is_recurring: true,
            type: "WORKER_TARGET",
            owner_id: { not: null }
        }
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    for (const goal of goals) {
        try {
            if (!goal.owner_id) continue;

            // 2. Calculate PENDING Commission Earned Today
            const stats = await prisma.transaction.aggregate({
                where: {
                    sender_id: goal.user_id,
                    type: "DEPOSIT",
                    status: "COMPLETED",
                    commission_status: "PENDING", // Only check pending ones
                    created_at: {
                        gte: todayStart,
                        lte: todayEnd
                    }
                },
                _sum: {
                    commission: true
                }
            });

            const pendingCommission = stats._sum.commission
                ? Number(stats._sum.commission)
                : 0;
            const target = Number(goal.target_amount);

            logger.info(
                `[Goals] Worker ${goal.user_id}: Pending Commission ${pendingCommission}, Target ${target}`
            );

            // 3. Evaluate
            if (pendingCommission >= target) {
                // Goal Met: Release funds to Worker.
                logger.info(
                    `[Goals] Worker ${goal.user_id} MET target. Releasing ${pendingCommission}.`
                );
                await releaseCommission(
                    goal.user_id,
                    goal.owner_id,
                    pendingCommission,
                    todayStart,
                    todayEnd
                );
            } else {
                // Goal Failed: Forfeit funds (Owner keeps them).
                logger.info(
                    `[Goals] Worker ${goal.user_id} FAILED target. Forfeiting ${pendingCommission}.`
                );
                await forfeitCommission(goal.user_id, todayStart, todayEnd);
            }
        } catch (err) {
            logger.error(`[Goals] Error processing goal ${goal.id}: ${err}`);
        }
    }
    logger.info("[Goals] Daily check completed.");
}

async function releaseCommission(
    workerId: string,
    ownerId: string,
    amount: number,
    startDate: Date,
    endDate: Date
) {
    if (amount <= 0) return;

    await prisma.$transaction(async (tx) => {
        // Update: Owner Wallet acts as the source of liquidity.
        await tx.wallet.update({
            where: { user_id: workerId },
            data: { balance: { increment: amount } }
        });

        // 2. Mark transactions as PAID
        await tx.transaction.updateMany({
            where: {
                sender_id: workerId,
                type: "DEPOSIT",
                status: "COMPLETED",
                commission_status: "PENDING",
                created_at: { gte: startDate, lte: endDate }
            },
            data: { commission_status: "PAID" }
        });
    });
}

async function forfeitCommission(
    workerId: string,
    startDate: Date,
    endDate: Date
) {
    // Just mark as FORFEITED. Owner already "has" the value (via Gross KioskDue).
    await prisma.transaction.updateMany({
        where: {
            sender_id: workerId,
            type: "DEPOSIT",
            status: "COMPLETED",
            commission_status: "PENDING",
            created_at: { gte: startDate, lte: endDate }
        },
        data: { commission_status: "FORFEITED" }
    });
}
