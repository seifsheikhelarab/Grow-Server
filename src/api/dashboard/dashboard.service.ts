import { errorHandler } from "../../middlewares/error.middleware.js";
import prisma from "../../prisma.js";
import logger from "../../utils/logger.js";
import { NotFoundError } from "../../utils/response.js";
import { TxStatus } from "@prisma/client";
import type { Response, Request } from "express";

/**
 * Get dashboard data for an Owner.
 *
 * @param {string} userId - The ID of the owner.
 * @returns {Promise<{ totalPoints: number; kiosks: Array<{ id: string; name: string; points: number; dues: number }> }>} The dashboard data.
 * @throws {NotFoundError} If the user or wallet is not found.
 */
export async function getOwnerDashboard(
    userId: string,
    req: Request,
    res: Response
): Promise<{
    totalPoints: number;
    kiosks: Array<{
        id: string;
        name: string;
        points: number;
        dues: number;
    }>;
} | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true }
        });

        if (!user) {
            errorHandler(new NotFoundError("User not found"), req, res);
            return null;
        }

        if (!user.wallet) {
            // Should catch this edge case if wallet is missing
            errorHandler(
                new NotFoundError("Wallet not found for user"),
                req,
                res
            );
            return null;
        }

        // 1. Total points collected by owner (Wallet Balance)
        const totalPoints = Number(user.wallet.balance);

        // 2. Kiosks owned by owner with their points and dues
        const kiosks = await prisma.kiosk.findMany({
            where: { owner_id: userId, is_active: true },
            include: {
                transactions: {
                    where: { status: TxStatus.COMPLETED }
                },
                dues: {
                    where: { is_paid: false }
                }
            }
        });

        const kioskData = kiosks.map((kiosk) => {
            // Points: Sum of amount_gross of completed transactions
            const points = kiosk.transactions.reduce(
                (acc, tx) => acc + Number(tx.amount_gross),
                0
            );

            // Dues: Sum of unpaid dues
            const dues = kiosk.dues.reduce(
                (acc, due) => acc + Number(due.amount),
                0
            );

            return {
                id: kiosk.id,
                name: kiosk.name,
                points,
                dues
            };
        });

        return {
            totalPoints,
            kiosks: kioskData
        };
    } catch (error) {
        logger.error("Error fetching owner dashboard data:", error);
        errorHandler(new error(), req, res);
        return null;
    }
}

/**
 * Get dashboard data for a Worker.
 *
 * @param {string} userId - The ID of the worker.
 * @returns {Promise<{ totalPoints: number; goal: { title: string; current: number; target: number } | null; transactions: Array<any> }>} The dashboard data.
 * @throws {NotFoundError} If the user or wallet is not found.
 */
export async function getWorkerDashboard(
    userId: string,
    req: Request,
    res: Response
): Promise<{
    totalPoints: number;
    goal: {
        title: string;
        current: number;
        target: number;
        deadline: Date | null;
    } | null;
    transactions: Array<{
        id: string;
        amount: number;
        type: string;
        status: string;
        created_at: Date;
    }>;
    kiosk: {
        id: string;
        name: string;
    };
}> | null {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true, worker_profile: true }
        });

        if (!user) {
            errorHandler(new NotFoundError("User not found"), req, res);
            return null;
        }

        if (!user.wallet) {
            errorHandler(
                new NotFoundError("Wallet not found for user"),
                req,
                res
            );
            return null;
        }

        // 1. Total points collected by worker (Wallet Balance)
        const totalPoints = Number(user.wallet.balance);

        // 2. Current Kiosk Goal (Type: WORKER_TARGET)
        const goal = await prisma.goal.findFirst({
            where: {
                user_id: userId,
                type: "WORKER_TARGET"
            },
            orderBy: {
                deadline: "asc" // Prioritize earliest deadline? Or creation?
            }
        });

        let currentAmount = 0;
        if (goal) {
            const result = await prisma.transaction.aggregate({
                where: {
                    sender_id: userId,
                    // Only count transactions created AFTER the goal started
                    created_at: {
                        gte: goal.created_at,
                        // And before deadline if it exists
                        lte: goal.deadline || undefined
                    },
                    type: "DEPOSIT", // Only count deposits (sales)
                    status: "COMPLETED"
                },
                _sum: {
                    amount_gross: true
                }
            });
            currentAmount = result._sum.amount_gross
                ? Number(result._sum.amount_gross)
                : 0;
        }

        // 3. Latest transactions by worker
        const transactions = await prisma.transaction.findMany({
            where: { sender_id: userId },
            orderBy: { created_at: "desc" },
            take: 5
        });

        const kiosk = await prisma.kiosk.findFirst({
            where: { id: user.worker_profile.kiosk_id },
            select: {
                name: true,
                id: true
            }
        });

        return {
            totalPoints,
            goal: goal
                ? {
                      title: goal.title,
                      current: currentAmount,
                      target: Number(goal.target_amount),
                      deadline: goal.deadline
                  }
                : null,
            transactions: transactions.map((tx) => ({
                id: tx.id,
                amount: Number(tx.amount_gross),
                type: tx.type,
                status: tx.status,
                created_at: tx.created_at
            })),
            kiosk: {
                id: kiosk?.id || null,
                name: kiosk?.name || null
            }
        };
    } catch (error) {
        logger.error("Error fetching worker dashboard data:", error);
        errorHandler(new error(), req, res);
        return null;
    }
}
