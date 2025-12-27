import { errorHandler } from "./../../middlewares/error.middleware.js";
import prisma from "../../prisma.js"; // Adjust path if needed
import {
    NotFoundError,
    AuthorizationError,
    ResponseHandler,
    ErrorCode
} from "../../utils/response.js";
import logger from "../../utils/logger.js";
import { Goal } from "@prisma/client";
import type { Request, Response } from "express";

/**
 * Set a daily recurring goal for a worker.
 * Owner must own the kiosk the worker is assigned to.
 *
 * @param {string} ownerId - The ID of the owner setting the goal.
 * @param {string} workerId - The ID of the worker.
 * @param {number} targetAmount - The target amount for the goal.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<Goal | null>} The created or updated goal.
 */
/**
 * Set a daily recurring goal for a worker.
 * Owner must own the kiosk the worker is assigned to.
 *
 * @param {string} ownerId - The ID of the owner setting the goal.
 * @param {string} workerId - The ID of the worker.
 * @param {number} targetAmount - The target amount for the goal.
 * @param {string} [kioskId] - The ID of the kiosk (optional but recommended for multi-kiosk).
 * @param {string} [workerProfileId] - The ID of the worker profile (optional, overrides workerId/kioskId search).
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<Goal | null>} The created or updated goal.
 */
export async function setWorkerGoal(
    ownerId: string,
    workerId: string,
    targetAmount: number,
    req: Request,
    res: Response,
    kioskId?: string,
    workerProfileId?: string
): Promise<Goal | null> {
    // 1. Determine Worker Profile
    let workerProfile = null;

    if (workerProfileId) {
        workerProfile = await prisma.workerProfile.findUnique({
            where: { id: workerProfileId },
            include: { kiosk: true }
        });
    } else if (kioskId) {
        // Find profile for this worker in this kiosk
        workerProfile = await prisma.workerProfile.findFirst({
            where: {
                user_id: workerId,
                kiosk_id: kioskId,
                status: "ACTIVE"
            },
            include: { kiosk: true }
        });
    } else {
        // Fallback: Find first active profile (Legacy support)
        // Danger: Arbitrary choice if multiple profiles exist.
        workerProfile = await prisma.workerProfile.findFirst({
            where: { user_id: workerId, status: "ACTIVE" },
            include: { kiosk: true }
        });
    }

    if (!workerProfile) {
        errorHandler(new NotFoundError("Worker profile not found"), req, res);
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
    // Strategy: Look for an existing recurring goal for this worker PROFILE and update it, or create new.
    const existingGoal = await prisma.goal.findFirst({
        where: {
            user_id: workerId,
            workerprofile_id: workerProfile.id,
            is_recurring: true,
            type: "WORKER_TARGET"
        }
    });

    if (existingGoal) {
        const updatedGoal = await prisma.goal.update({
            where: { id: existingGoal.id },
            data: {
                target_amount: targetAmount,
                owner_id: ownerId
            }
        });
        return updatedGoal;
    } else {
        const newGoal = await prisma.goal.create({
            data: {
                user_id: workerId,
                workerprofile_id: workerProfile.id,
                owner_id: ownerId,
                kiosk_id: workerProfile.kiosk_id,
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
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} ownerId - The ID of the owner.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[] | null>} List of goals and their status.
 */
export async function getKioskGoal(
    kioskId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
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
            errorHandler(
                new AuthorizationError(
                    "You are not authorized to access this kiosk"
                ),
                req,
                res
            );
            return null;
        }

        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            include: { user: true }
        });

        if (!workers) {
            return [];
        }

        const goals = [];

        for (const worker of workers) {
            // Find goal specifically linked to this profile
            const goal = await prisma.goal.findFirst({
                where: {
                    workerprofile_id: worker.id,
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
                    workerprofile_id: worker.id, // Filter by profile ID
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

            const status =
                commission >= targetAmount ? "ACHIEVED" : "NOT_ACHIEVED";

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
 * Iterates through all active recurring goals and releases/forfeits commissions.
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

            const whereClause: any = {
                sender_id: goal.user_id,
                type: "DEPOSIT",
                status: "COMPLETED",
                commission_status: "PENDING",
                created_at: {
                    gte: todayStart,
                    lte: todayEnd
                }
            };

            // Check if goal is linked to worker profile (New Schema)
            if (goal.workerprofile_id) {
                whereClause.workerprofile_id = goal.workerprofile_id;
            }

            // 2. Calculate PENDING Commission Earned Today
            const stats = await prisma.transaction.aggregate({
                where: whereClause,
                _sum: {
                    commission: true
                }
            });

            const pendingCommission = stats._sum.commission
                ? Number(stats._sum.commission)
                : 0;
            const target = Number(goal.target_amount);

            logger.info(
                `[Goals] Worker ${goal.user_id} (Profile: ${goal.workerprofile_id}): Pending Commission ${pendingCommission}, Target ${target}`
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
                    todayEnd,
                    goal.workerprofile_id || undefined
                );
            } else {
                // Goal Failed: Forfeit funds (Owner keeps them).
                logger.info(
                    `[Goals] Worker ${goal.user_id} FAILED target. Forfeiting ${pendingCommission}.`
                );
                await forfeitCommission(
                    goal.user_id,
                    todayStart,
                    todayEnd,
                    goal.workerprofile_id || undefined
                );
            }
        } catch (err) {
            logger.error(`[Goals] Error processing goal ${goal.id}: ${err}`);
        }
    }
    logger.info("[Goals] Daily check completed.");
}

/**
 * Release commission to worker.
 *
 * @param {string} workerId - The ID of the worker.
 * @param {string} ownerId - The ID of the owner.
 * @param {number} amount - The amount to release.
 * @param {Date} startDate - The start date of the period.
 * @param {Date} endDate - The end date of the period.
 */
async function releaseCommission(
    workerId: string,
    ownerId: string,
    amount: number,
    startDate: Date,
    endDate: Date,
    workerProfileId?: string
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

        const whereClause: any = {
            sender_id: workerId,
            type: "DEPOSIT",
            status: "COMPLETED",
            commission_status: "PENDING",
            created_at: { gte: startDate, lte: endDate }
        };

        if (workerProfileId) {
            whereClause.workerprofile_id = workerProfileId;
        }

        // 2. Mark transactions as PAID
        await tx.transaction.updateMany({
            where: whereClause,
            data: { commission_status: "PAID" }
        });
    });
}

/**
 * Forfeit commission (remains with owner).
 *
 * @param {string} workerId - The ID of the worker.
 * @param {Date} startDate - The start date of the period.
 * @param {Date} endDate - The end date of the period.
 */
async function forfeitCommission(
    workerId: string,
    startDate: Date,
    endDate: Date,
    workerProfileId?: string
) {
    const whereClause: any = {
        sender_id: workerId,
        type: "DEPOSIT",
        status: "COMPLETED",
        commission_status: "PENDING",
        created_at: { gte: startDate, lte: endDate }
    };

    if (workerProfileId) {
        whereClause.workerprofile_id = workerProfileId;
    }

    // Just mark as FORFEITED. Funds explicitly remain with Owner (sent during transaction).
    await prisma.transaction.updateMany({
        where: whereClause,
        data: { commission_status: "FORFEITED" }
    });
}

/**
 * Get goal status for a worker.
 *
 * @param {string} workerId - The ID of the worker.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[]>} History of goal performance for the last 7 days.
 */
export async function getGoalWorker(
    workerId: string,
    req: Request,
    res: Response,
    workerProfileId?: string
) {
    try {
        const whereClause: any = {
            user_id: workerId,
            is_recurring: true,
            type: "WORKER_TARGET"
        };
        if (workerProfileId) {
            whereClause.workerprofile_id = workerProfileId;
        }

        const goal = await prisma.goal.findFirst({
            where: whereClause
        });

        if (!goal) {
            return ResponseHandler.error(
                res,
                "Goal not found",
                ErrorCode.RESOURCE_NOT_FOUND
            );
        }

        const history = [];
        const targetAmount = Number(goal.target_amount);

        // Iterate for the last 7 days (including today)
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const txWhere: any = {
                sender_id: workerId,
                type: "DEPOSIT",
                status: "COMPLETED",
                created_at: {
                    gte: dayStart,
                    lte: dayEnd
                }
            };
            if (workerProfileId) {
                txWhere.workerprofile_id = workerProfileId;
            }

            const achieved = await prisma.transaction.aggregate({
                where: txWhere,
                _sum: {
                    commission: true
                }
            });

            const commission = Number(achieved._sum.commission || 0);
            const status =
                commission >= targetAmount ? "ACHIEVED" : "NOT_ACHIEVED";

            history.push({
                date: dayStart.toISOString().split("T")[0], // YYYY-MM-DD
                commission,
                targetAmount,
                status
            });
        }

        return history; // Returns array of 7 items
    } catch (error) {
        errorHandler(error, req, res);
        return ResponseHandler.error(
            res,
            "Failed to retrieve goal",
            ErrorCode.INTERNAL_ERROR
        );
    }
}

/**
 * Get aggregated goals for a kiosk.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ commission: number; targetAmount: number; status: string }>} Aggregated goal status.
 */
export async function getKioskGoals(
    kioskId: string,
    req: Request,
    res: Response
) {
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

        const totalTarget = goals.reduce(
            (acc, curr) => acc + Number(curr.target_amount),
            0
        );

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

        const commission = achieved._sum.commission
            ? achieved._sum.commission.toNumber()
            : 0;

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
        return ResponseHandler.error(
            res,
            "Failed to retrieve goals",
            ErrorCode.INTERNAL_ERROR
        );
    }
}
