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

export async function setKioskGoal(
    ownerId: string,
    targetAmount: number,
    req: Request,
    res: Response,
    kioskId: string
): Promise<Goal | null> {
    const kiosk = await prisma.kiosk.findFirst({
        where: { id: kioskId, owner_id: ownerId, is_active: true },
        include: { workers: true }
    });

    if (!kiosk) {
        errorHandler(new NotFoundError("لم يتم العثور على الكشك"), req, res);
        return null;
    }

    if (kiosk.owner_id !== ownerId) {
        errorHandler(
            new AuthorizationError("أنت غير مصرح لك بالوصول إلى هذا الكشك"),
            req,
            res
        );
        return null;
    }

    // 1. Archive Existing Active Goal
    const existingGoal = await prisma.goal.findFirst({
        where: {
            kiosk_id: kioskId,
            status: "ACTIVE",
            type: "WORKER_TARGET"
        }
    });

    if (existingGoal) {
        await prisma.goal.update({
            where: { id: existingGoal.id },
            data: {
                status: "ARCHIVED"
            }
        });
    }

    const newGoal = await prisma.goal.create({
        data: {
            owner_id: ownerId,
            kiosk_id: kioskId,
            title: "هدف يومي",
            target_amount: targetAmount,
            type: "WORKER_TARGET",
            is_recurring: true,
            status: "ACTIVE",
            deadline: null
        }
    });

    return newGoal;
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
            errorHandler(
                new NotFoundError("لم يتم العثور على الكشك"),
                req,
                res
            );
            return null;
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("أنت غير مصرح لك بالوصول إلى هذا الكشك"),
                req,
                res
            );
            return null;
        }

        // Fetch the single ACTIVE goal for this Kiosk
        const goal = await prisma.goal.findFirst({
            where: {
                kiosk_id: kioskId,
                status: "ACTIVE",
                type: "WORKER_TARGET"
            }
        });

        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            include: { user: true }
        });

        if (!workers) {
            return [];
        }

        const goals = [];

        for (const worker of workers) {
            if (!goal) {
                // Return structure with 0/null if no goal is set
                goals.push({
                    id: null,
                    target_amount: 0,
                    worker_name: worker.user.full_name,
                    worker_id: worker.user_id,
                    progress: 0,
                    status: "NOT_SET"
                });
                continue;
            }

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

            const commission = Number(achieved._sum.commission || 0);
            const targetAmount = Number(goal.target_amount);

            const status =
                commission >= targetAmount ? "ACHIEVED" : "NOT_ACHIEVED";

            goals.push({
                id: goal.id,
                target_amount: goal.target_amount,
                worker_name: worker.user.full_name,
                worker_id: worker.user_id,
                progress: commission,
                status
            });
        }

        return goals;
    } catch (error) {
        errorHandler(new Error("حدث خطأ أثناء الحصول على هدف الكشك"), req, res);
        logger.error(error);
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

    // 1. Get all active recurring goals (Kiosk-wide)
    const goals = await prisma.goal.findMany({
        where: {
            is_recurring: true,
            type: "WORKER_TARGET",
            status: "ACTIVE", // Only active goals
            kiosk_id: { not: null }
        },
        include: {
            kiosk: {
                include: {
                    workers: {
                        where: { status: "ACTIVE" }
                    }
                }
            }
        }
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    for (const goal of goals) {
        try {
            if (!goal.owner_id || !goal.kiosk) continue;

            const target = Number(goal.target_amount);

            // Iterate through each active worker in the kiosk
            for (const worker of goal.kiosk.workers) {
                const whereClause: any = {
                    sender_id: worker.user_id,
                    type: "DEPOSIT",
                    status: "COMPLETED",
                    commission_status: "PENDING",
                    created_at: {
                        gte: todayStart,
                        lte: todayEnd
                    },
                    // Ensure we check transactions for this specific worker profile
                    workerprofile_id: worker.id
                };

                // 2. Calculate PENDING Commission Earned Today for this worker
                const stats = await prisma.transaction.aggregate({
                    where: whereClause,
                    _sum: {
                        commission: true
                    }
                });

                const pendingCommission = stats._sum.commission
                    ? Number(stats._sum.commission)
                    : 0;

                logger.info(
                    `[Goals] Kiosk ${goal.kiosk_id} - Worker ${worker.user_id} (Profile: ${worker.id}): Pending Commission ${pendingCommission}, Target ${target}`
                );

                // 3. Evaluate
                if (pendingCommission >= target) {
                    // Goal Met: Release funds to Worker.
                    logger.info(
                        `[Goals] Worker ${worker.user_id} MET target. Releasing ${pendingCommission}.`
                    );
                    await releaseCommission(
                        worker.user_id,
                        goal.owner_id,
                        pendingCommission,
                        todayStart,
                        todayEnd,
                        worker.id
                    );
                } else {
                    // Goal Failed: Forfeit funds (Owner keeps them).
                    logger.info(
                        `[Goals] Worker ${worker.user_id} FAILED target. Forfeiting ${pendingCommission}.`
                    );
                    await forfeitCommission(
                        worker.user_id,
                        todayStart,
                        todayEnd,
                        worker.id
                    );
                }
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
    kioskIdIfFiltered?: string, // Added argument for flexibility if needed, or derived
    workerProfileId?: string
) {
    try {
        // Need to find which Kiosk(s) this worker belongs to, or use profileId
        // The goal is now linked to Kiosk, not directly to User (mostly).

        let profileId = workerProfileId;

        // If profile not provided, find active profile? Or just iterate all?
        // User asked "view past goals".
        // We will look for goals associated with the Kiosk of the worker.

        if (!profileId) {
            const profile = await prisma.workerProfile.findFirst({
                where: { user_id: workerId } // Just grabbing one for now if not specified
            });
            if (profile) profileId = profile.id;
        } else {
            const profile = await prisma.workerProfile.findUnique({
                where: { id: workerProfileId }
            });
            if (profile) profileId = profile.id;
        }

        if (!profileId) return []; // No profile found

        const profile = await prisma.workerProfile.findUnique({
            where: { id: profileId }
        });

        if (!profile) return [];

        const kioskId = profile.kiosk_id;

        const history = [];

        // Iterate for the last 7 days (including today)
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const goal = await prisma.goal.findFirst({
                where: {
                    kiosk_id: kioskId,
                    type: "WORKER_TARGET",
                    created_at: { lte: dayEnd }
                },
                orderBy: { created_at: "desc" }
            });
            let dailyTarget = 0;
            let status = "NOT_SET";

            if (goal) {
                const wasArchivedBeforeDay =
                    goal.status === "ARCHIVED" && goal.updated_at < dayStart;

                if (!wasArchivedBeforeDay) {
                    dailyTarget = Number(goal.target_amount);
                }
            }

            const txWhere: any = {
                workerprofile_id: profileId,
                type: "DEPOSIT",
                status: "COMPLETED",
                created_at: {
                    gte: dayStart,
                    lte: dayEnd
                }
            };

            const achieved = await prisma.transaction.aggregate({
                where: txWhere,
                _sum: {
                    commission: true
                }
            });

            const commission = Number(achieved._sum.commission || 0);

            if (dailyTarget > 0) {
                status =
                    commission >= dailyTarget ? "ACHIEVED" : "NOT_ACHIEVED";
            }

            history.push({
                date: dayStart.toISOString().split("T")[0], // YYYY-MM-DD
                commission,
                targetAmount: dailyTarget,
                status
            });
        }

        return {
            current: history[0],
            history: history.splice(1)
        };
    } catch (error) {
        errorHandler(new Error("حدث خطأ أثناء الحصول على هدف"), req, res);
        logger.error(error);
        return ResponseHandler.error(
            res,
            "حدث خطأ أثناء الحصول على هدف",
            ErrorCode.INTERNAL_ERROR
        );
    }
}

/**
 * Delete (Archive) the goal for a kiosk.
 *
 * @param kioskId
 * @param ownerId
 * @param req
 * @param res
 */
export async function deleteKioskGoal(
    kioskId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
    const kiosk = await prisma.kiosk.findFirst({
        where: { id: kioskId, owner_id: ownerId, is_active: true }
    });

    if (!kiosk || kiosk.owner_id !== ownerId) {
        errorHandler(new AuthorizationError("غير مصرح"), req, res);
        return null;
    }

    // Archive current active goal
    await prisma.goal.updateMany({
        where: {
            kiosk_id: kioskId,
            status: "ACTIVE",
            type: "WORKER_TARGET"
        },
        data: {
            status: "ARCHIVED"
        }
    });

    return { message: "Goal removed" };
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
        errorHandler(new Error("حدث خطأ أثناء الحصول على هدف الكشك"), req, res);
        logger.error(error);
        return ResponseHandler.error(
            res,
            "حدث خطأ أثناء الحصول على هدف الكشك",
            ErrorCode.INTERNAL_ERROR
        );
    }
}
