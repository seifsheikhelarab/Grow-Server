import { errorHandler } from "../../middlewares/error.middleware.js";
import prisma from "../../prisma.js";
import logger from "../../utils/logger.js";
import { AppError, BusinessLogicError, ErrorCode, HttpStatus, NotFoundError } from "../../utils/response.js";
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
            errorHandler(
                new NotFoundError("لم يتم العثور على المستخدم"),
                req,
                res
            );
            return null;
        }

        if (!user.wallet) {
            // Should catch this edge case if wallet is missing
            errorHandler(
                new NotFoundError("لم يتم العثور على المحفظة للمستخدم"),
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
                (acc, tx) => acc + Number(tx.commission),
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
                points: Number(points.toFixed(0)),
                dues: Number(dues.toFixed(0))
            };
        });

        return {
            totalPoints,
            kiosks: kioskData
        };
    } catch (error) {
        logger.error("Error fetching owner dashboard data:", error);
        errorHandler(
            new Error("حدث خطأ أثناء استرجاع بيانات لوحة التحكم"),
            req,
            res
        );
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
    workerProfileId: string | undefined,
    req: Request,
    res: Response
): Promise<{
    totalPoints: number;
    goal: {
        title: string;
        current: number;
        target: number;
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
        const workerprofile = await prisma.workerProfile.findFirst({
            where: {
                id: workerProfileId,
                status: "ACTIVE"
            }
        });

        if (!workerprofile) {
            console.log("Here")
            errorHandler(
                new AppError("لا يوجد ملف تعريف عامل نشط، انتظر دعوة لبدء رحلتك", HttpStatus.NOT_FOUND),
                req,
                res
            );
            return null;
        }

        if (workerprofile.user_id !== userId) {
            errorHandler(
                new AppError("لا يوجد ملف تعريف عامل نشط، انتظر دعوة لبدء رحلتك", HttpStatus.NOT_FOUND),
                req,
                res
            );
            return null;
        }

        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date();
        dayEnd.setHours(23, 59, 59, 999);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true, worker_profiles: true }
        });

        if (!user) {
            errorHandler(
                new AppError("لم يتم العثور على المستخدم", HttpStatus.NOT_FOUND),
                req,
                res
            );
            return null;
        }

        if (!user.wallet) {
            errorHandler(
                new AppError("لم يتم العثور على المحفظة للمستخدم", HttpStatus.NOT_FOUND),
                req,
                res
            );
            return null;
        }

        // Get the active worker profile (use provided ID or find first active)
        let activeProfile = null;
        if (workerProfileId) {
            activeProfile = await prisma.workerProfile.findUnique({
                where: { id: workerProfileId }
            });
        } else {
            activeProfile = await prisma.workerProfile.findFirst({
                where: { status: "ACTIVE" }
            });
        }

        if (!activeProfile) {
            errorHandler(
                new AppError("لا يوجد ملف تعريف عامل نشط، انتظر دعوة لبدء رحلتك", HttpStatus.NOT_FOUND),
                req,
                res
            );
            return null;
        }

        // 1. Total points collected by worker (Wallet Balance - shared)
        const totalPoints = Number(user.wallet.balance);

        // 2. Current Kiosk Goal for this profile (Type: WORKER_TARGET)
        const goal = await prisma.goal.findFirst({
            where: {
                user_id: userId,
                kiosk_id: activeProfile.kiosk_id,
                type: "WORKER_TARGET"
            },
            orderBy: {
                deadline: "asc"
            }
        });

        let currentAmount = 0;
        if (goal) {
            const result = await prisma.transaction.aggregate({
                where: {
                    workerprofile_id: activeProfile.id,
                    created_at: {
                        gte: dayStart,
                        lte: dayEnd
                    },
                    type: "DEPOSIT",
                    status: "COMPLETED"
                },
                _sum: {
                    commission: true
                }
            });

            currentAmount = result._sum.commission
                ? Number(result._sum.commission)
                : 0;
        }

        // 3. Latest transactions for this profile
        const transactions = await prisma.transaction.findMany({
            where: { workerprofile_id: activeProfile.id },
            orderBy: { created_at: "desc" },
            take: 5
        });

        const kiosk = await prisma.kiosk.findFirst({
            where: { id: activeProfile.kiosk_id },
            select: {
                name: true,
                id: true
            }
        });

        return {
            totalPoints: Number(totalPoints.toFixed(0)),
            goal: goal
                ? {
                    title: goal.title,
                    current: currentAmount,
                    target: Number(goal.target_amount)
                }
                : null,
            transactions: transactions.map((tx) => ({
                id: tx.id,
                amount: Number(tx.amount_gross.toFixed(0)),
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
        errorHandler(
            new BusinessLogicError("حدث خطأ أثناء استرجاع بيانات لوحة التحكم", ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
        return null;
    }
}
