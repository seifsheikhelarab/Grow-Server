import { errorHandler } from "./../../middlewares/error.middleware.js";
import prisma from "../../prisma.js"; // Adjust path if needed
import { NotFoundError, AuthorizationError, ResponseHandler, ErrorCode } from "../../utils/response.js";
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
        errorHandler(
            new AuthorizationError(
                "You can only set goals for your own workers"
            ),
            req,
            res
        );
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
        const updatedGoal = await prisma.goal.upsert({
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
        const newGoal = await prisma.goal.create({
            data: {
                user_id: workerId,
                owner_id: ownerId,
                title: "Daily Commission Target",
                target_amount: targetAmount,
                type: "WORKER_TARGET",
                is_recurring: true,
                deadline: null // Recurring has no fixed deadline, it happens daily
            }
        });
        return newGoal;
    }
}

/**
 * Get the current active goal for a kiosk.
 */
export async function getKioskGoal(kioskId: string, ownerId: string, req: Request, res: Response) {

    try {

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId },
            include: { owner: true }
        });

        if (!kiosk) {
            errorHandler(new NotFoundError("Kiosk not found"), req, res);
            return null;
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(new AuthorizationError("You are not authorized to access this kiosk"), req, res);
            return null;
        }


        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            include: { user: true }
        });

        if (!workers) {
            errorHandler(new NotFoundError("Workers not found"), req, res);
            return null;
        }

        const goals = [];

        for (const worker of workers) {
            const goal = await prisma.goal.findFirst({
                where: {
                    user_id: worker.user_id,
                    is_recurring: true,
                    type: "WORKER_TARGET"
                },
                include: {
                    user: true
                }
            });

            if (!goal) continue;

            const achieved = await prisma.transaction.aggregate({
                where: {
                    sender_id: worker.user_id,
                    type: "DEPOSIT",
                    status: "COMPLETED",
                    commission_status: "PENDING",
                    created_at: {
                        gte: todayStart,
                        lte: todayEnd
                    }
                },
                _sum: {
                    commission: true
                }
            });

            const commission = Number(achieved._sum.commission);
            const targetAmount = Number(goal.target_amount);

            const status = commission >= targetAmount ? "ACHIEVED" : "NOT_ACHIEVED";

            goals.push({
                id: goal.id,
                target_amount: goal.target_amount,
                worker_name: goal.user.full_name,
                worker_id: goal.user_id,
                progress: Number(achieved._sum.commission),
                status

            });
        }

        return goals;
    } catch (error) {
        errorHandler(error, req, res);
        return null;
    }

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
        // 1. Transfer funds: Owner -> Worker
        // Determine commission already sits in Owner's wallet. We must move it to Worker.

        // Decrement Owner Wallet
        await tx.wallet.update({
            where: { user_id: ownerId },
            data: { balance: { decrement: amount } }
        });

        // Increment Worker Wallet
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
    // Just mark as FORFEITED. Funds explicitly remain with Owner (sent during transaction).
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

export async function getGoalWorker(workerId: string, req: Request, res: Response) {
    try {


        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const goal = await prisma.goal.findFirst({
            where: {
                user_id: workerId,
                is_recurring: true,
                type: "WORKER_TARGET"
            }
        });

        if (!goal) {
            return ResponseHandler.error(res, "Goal not found", ErrorCode.RESOURCE_NOT_FOUND);
        }

        const achieved = await prisma.transaction.aggregate({
            where: {
                sender_id: workerId,
                type: "DEPOSIT",
                status: "COMPLETED",
                commission_status: "PENDING",
                created_at: {
                    gte: todayStart,
                    lte: todayEnd
                }
            },
            _sum: {
                commission: true
            }
        });

        const commission = Number(achieved._sum.commission);
        const targetAmount = Number(goal.target_amount);

        const status = commission >= targetAmount ? "ACHIEVED" : "NOT_ACHIEVED";

        return {
            commission,
            targetAmount,
            status
        };
    } catch (error) {
        errorHandler(error, req, res);
        return ResponseHandler.error(res, "Failed to retrieve goal", ErrorCode.INTERNAL_ERROR);
    }
}

export async function getKioskGoals(kioskId: string, req: Request, res: Response) {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const workers = await prisma.workerProfile.findMany({
            where: {
                kiosk_id: kioskId,
                status: "ACTIVE"
            }
        });

        const workerIds = workers.map((worker) => worker.user_id);

        const goals = await prisma.goal.findMany({
            where: {
                user_id: { in: workerIds },
                is_recurring: true,
                type: "KIOSK_TARGET"
            }
        });

        const totalTarget = goals.reduce((acc, curr) => acc + Number(curr.target_amount), 0);

        const achieved = await prisma.transaction.aggregate({
            where: {
                sender_id: { in: workerIds },
                type: "DEPOSIT",
                status: "COMPLETED",
                commission_status: "PENDING",
                created_at: {
                    gte: todayStart,
                    lte: todayEnd
                }
            },
            _sum: {
                commission: true
            }
        });

        const commission = achieved._sum.commission ? achieved._sum.commission.toNumber() : 0;

        let status = "NOT_ACHIEVED";
        if (goals.length > 0 && commission >= totalTarget) {
            status = "ACHIEVED";
        }

        return {
            commission,
            targetAmount: totalTarget,
            status
        };
    } catch (error) {
        errorHandler(error, req, res);
        return ResponseHandler.error(res, "Failed to retrieve goals", ErrorCode.INTERNAL_ERROR);
    }
}