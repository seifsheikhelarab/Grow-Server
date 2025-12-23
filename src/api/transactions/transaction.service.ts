import { errorHandler } from "./../../middlewares/error.middleware.js";
import { Request, Response } from "express";
import prisma from "../../prisma.js";
import {
    NotFoundError,
    AuthorizationError,
    BusinessLogicError,
    ErrorCode,
    AppError
} from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Constants for transaction limits
 */
/**
 * Fetch dynamic transaction constraints from system settings.
 */
async function getTransactionSettings() {
    const settings = await prisma.systemSetting.findMany({
        where: {
            key: {
                in: [
                    "commission_rate",
                    "max_transaction_amount",
                    "max_daily_tx",
                    "max_daily_tx_to_customer"
                ]
            }
        }
    });

    const settingsMap = settings.reduce(
        (acc, s) => {
            try {
                acc[s.key] = JSON.parse(s.value);
            } catch {
                acc[s.key] = s.value; // Fallback for plain strings if any
            }
            return acc;
        },
        {} as Record<string, unknown>
    );

    return {
        commissionRate: Number(settingsMap["commission_rate"] || 5),
        maxTransactionAmount: Number(
            settingsMap["max_transaction_amount"] || 100
        ),
        maxDailyTxPerWorker: Number(settingsMap["max_daily_tx"] || 150),
        maxDailyTxToCustomer: Number(
            settingsMap["max_daily_tx_to_customer"] || 2
        )
    };
}

/**
 * Validate sender is active worker/owner.
 *
 * @param {string} senderId - The ID of the sender.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The validated user object.
 */
async function validateSender(senderId: string, req: Request, res: Response) {
    const user = await prisma.user.findUnique({
        where: { id: senderId },
        include: { worker_profile: true }
    });

    if (!user) {
        errorHandler(new NotFoundError("User not found"), req, res);
    }

    if (!user.is_active) {
        errorHandler(
            new BusinessLogicError(
                "User account is not active",
                ErrorCode.WORKER_NOT_ACTIVE
            ),
            req,
            res
        );
    }

    if (!user.is_verified) {
        errorHandler(
            new BusinessLogicError(
                "User account is not verified",
                ErrorCode.WORKER_NOT_ACTIVE
            ),
            req,
            res
        );
    }

    if (user.role !== "WORKER" && user.role !== "OWNER") {
        errorHandler(
            new AuthorizationError("Only workers and owners can send points"),
            req,
            res
        );
    }

    // Check if worker profile is active
    if (user.role === "WORKER" && user.worker_profile) {
        if (user.worker_profile.status !== "ACTIVE") {
            errorHandler(
                new BusinessLogicError(
                    "Worker profile is not active",
                    ErrorCode.WORKER_NOT_ACTIVE
                ),
                req,
                res
            );
        }
    }

    return user;
}

/**
 * Validate kiosk.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} senderId - The ID of the sender.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The validated kiosk object.
 */
async function validateKiosk(
    kioskId: string,
    senderId: string,
    req: Request,
    res: Response
) {
    const kiosk = await prisma.kiosk.findUnique({
        where: { id: kioskId }
    });

    if (!kiosk) {
        errorHandler(new NotFoundError("Kiosk not found"), req, res);
    }

    // Verify sender is owner or worker of this kiosk
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        include: { worker_profile: true }
    });

    if (sender?.role === "OWNER" && kiosk.owner_id !== senderId) {
        errorHandler(
            new AuthorizationError("You are not the owner of this kiosk"),
            req,
            res
        );
    }

    if (
        sender?.role === "WORKER" &&
        sender.worker_profile?.kiosk_id !== kioskId
    ) {
        errorHandler(
            new AuthorizationError("You are not assigned to this kiosk"),
            req,
            res
        );
    }

    return kiosk;
}

/**
 * Check transaction constraints.
 *
 * @param {string} senderId - The ID of the sender.
 * @param {string} receiverPhone - The phone number of the receiver.
 * @param {string} kioskId - The ID of the kiosk.
 * @param {number} amount - The transaction amount.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<void>}
 */
async function checkConstraints(
    senderId: string,
    receiverPhone: string,
    kioskId: string,
    amount: number,
    settings: {
        maxTransactionAmount: number;
        maxDailyTxToCustomer: number;
        maxDailyTxPerWorker: number;
    },
    req: Request,
    res: Response
) {
    const { maxTransactionAmount, maxDailyTxToCustomer, maxDailyTxPerWorker } =
        settings;

    // Constraint 1: Amount <= maxTransactionAmount
    if (amount > maxTransactionAmount) {
        errorHandler(
            new BusinessLogicError(
                `Transaction amount cannot exceed ${maxTransactionAmount}`,
                ErrorCode.INVALID_TRANSACTION_AMOUNT,
                { max: maxTransactionAmount, requested: amount }
            ),
            req,
            res
        );
    }

    // Constraint 2: Daily Tx count to this specific customer < maxDailyTxToCustomer
    const dailyTxsToCustomer = await prisma.transaction.count({
        where: {
            sender_id: senderId,
            receiver_phone: receiverPhone,
            kiosk_id: kioskId,
            created_at: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        }
    });

    if (dailyTxsToCustomer >= maxDailyTxToCustomer) {
        errorHandler(
            new BusinessLogicError(
                `Daily transaction limit to this customer (${maxDailyTxToCustomer}) exceeded`,
                ErrorCode.DAILY_TX_TO_USER_LIMIT,
                { max: maxDailyTxToCustomer, current: dailyTxsToCustomer }
            ),
            req,
            res
        );
    }

    // Constraint 3: Total Daily Tx count for this worker < maxDailyTxPerWorker
    const totalDailyTxs = await prisma.transaction.count({
        where: {
            sender_id: senderId,
            created_at: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        }
    });

    if (totalDailyTxs >= maxDailyTxPerWorker) {
        errorHandler(
            new BusinessLogicError(
                `Daily transaction limit (${maxDailyTxPerWorker}) exceeded`,
                ErrorCode.DAILY_LIMIT_EXCEEDED,
                { max: maxDailyTxPerWorker, current: totalDailyTxs }
            ),
            req,
            res
        );
    }
}

/**
 * Send points - Core Logic.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {string} senderId - The ID of the sender.
 * @param {string} receiverPhone - The phone number of the receiver.
 * @param {string} kioskId - The ID of the kiosk.
 * @param {number} amount - The transaction amount.
 * @returns {Promise<object>} The transaction result containing transaction record and due.
 */
export async function sendPoints(
    req: Request,
    res: Response,
    senderId: string,
    receiverPhone: string,
    kioskId: string,
    amount: number
) {
    try {
        // Validate sender
        const sender = await validateSender(senderId, req, res);

        // Validate kiosk
        const kiosk = await validateKiosk(kioskId, senderId, req, res);

        // Get settings
        const settings = await getTransactionSettings();

        // Check constraints
        await checkConstraints(
            senderId,
            receiverPhone,
            kioskId,
            amount,
            settings,
            req,
            res
        );

        // Calculate amounts
        const fee = settings.commissionRate;
        const customerAmount = amount - fee;
        const commission = settings.commissionRate;

        // Check for active recurring goal (Daily Target) created by owner
        const activeGoal = await prisma.goal.findFirst({
            where: {
                user_id: senderId,
                type: "WORKER_TARGET",
                is_recurring: true,
                owner_id: kiosk.owner_id
            }
        });

        // Determine commission status
        // If goal exists, we HOLD the commission (PENDING) and send it to Owner.
        // If no goal, we PAY it immediately (PAID) to Worker.
        const commissionStatus = activeGoal ? "PENDING" : "PAID";

        logger.info(
            `[TX] Starting transaction: ${amount} from ${sender.phone} to ${receiverPhone}. Commission Status: ${commissionStatus}`
        );

        // Execute within transaction
        const result = await prisma.$transaction(async (tx) => {
            // Check if receiver is registered user or shadow wallet
            let receiverId: string | null = null;
            const receiver = await tx.user.findUnique({
                where: { phone: receiverPhone }
            });

            if (receiver) {
                // Add to user wallet
                await tx.wallet.update({
                    where: { user_id: receiver.id },
                    data: { balance: { increment: customerAmount } }
                });
                receiverId = receiver.id;
                logger.info(`[TX] Added ${customerAmount} to receiver wallet`);
            } else {
                // Add to shadow wallet
                await tx.shadowWallet.upsert({
                    where: { phone: receiverPhone },
                    update: { balance: { increment: customerAmount } },
                    create: { phone: receiverPhone, balance: customerAmount }
                });
                logger.info(`[TX] Added ${customerAmount} to shadow wallet`);
            }

            // Handle Commission
            if (commissionStatus === "PAID") {
                // No Goal: Pay Worker immediately
                await tx.wallet.update({
                    where: { user_id: senderId },
                    data: { balance: { increment: commission } }
                });
                logger.info(
                    `[TX] Added ${commission} commission to sender (Worker)`
                );
            } else {
                // Goal Exists: Send to Owner (Held/Pending)
                await tx.wallet.update({
                    where: { user_id: kiosk.owner_id },
                    data: { balance: { increment: commission } }
                });
                logger.info(
                    `[TX] Sent ${commission} commission to Owner (PENDING for Worker)`
                );
            }

            // Create kiosk due
            const due = await tx.kioskDue.create({
                data: {
                    kiosk_id: kioskId,
                    amount: amount
                }
            });
            logger.info(`[TX] Created due: ${due.id}`);

            // Create transaction record
            const transaction = await tx.transaction.create({
                data: {
                    sender_id: senderId,
                    receiver_phone: receiverPhone,
                    receiver_id: receiverId,
                    kiosk_id: kioskId,
                    amount_gross: amount,
                    amount_net: customerAmount,
                    commission: commission,
                    type: "DEPOSIT",
                    status: "COMPLETED",
                    commission_status: commissionStatus
                }
            });
            logger.info(`[TX] Transaction recorded: ${transaction.id}`);

            return {
                transaction,
                due
            };
        });

        logger.info(`[TX] Transaction completed successfully`);
        return result;
    } catch (err) {
        logger.error(`Error sending points: ${err}`);
        errorHandler(
            new AppError("Error sending points", 500, ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
        return { transaction: null, due: null };
    }
}

/**
 * Get user transaction history.
 *
 * @param {string} userId - The ID of the user.
 * @param {number} limit - The number of records to retrieve (default: 20).
 * @param {number} offset - The number of records to skip (default: 0).
 * @returns {Promise<object>} The transaction history and total count.
 */
export async function getTransactionHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    req: Request,
    res: Response
) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [{ sender_id: userId }, { receiver_id: userId }]
            },
            include: {
                kiosk: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { created_at: "desc" },
            take: limit,
            skip: offset
        });

        const total = await prisma.transaction.count({
            where: {
                OR: [{ sender_id: userId }, { receiver_id: userId }]
            }
        });

        return {
            transactions: transactions.map((t) => ({
                id: t.id,
                sender_id: t.sender_id,
                receiver_phone: t.receiver_phone,
                receiver_id: t.receiver_id,
                amount_gross: t.amount_gross.toNumber
                    ? t.amount_gross.toNumber()
                    : Number(t.amount_gross),
                amount_net: t.amount_net.toNumber
                    ? t.amount_net.toNumber()
                    : Number(t.amount_net),
                commission: t.commission.toNumber
                    ? t.commission.toNumber()
                    : Number(t.commission),
                type: t.type,
                status: t.status,
                kiosk: t.kiosk,
                created_at: t.created_at
            })),
            total
        };
    } catch (err) {
        logger.error(`Error getting transaction history: ${err}`);
        errorHandler(
            new AppError(
                "Error getting transaction history",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return { transactions: [], total: 0 };
    }
}

/**
 * Get daily transaction stats.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} The daily transaction statistics.
 */
export async function getDailyStats(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stats = await prisma.transaction.aggregate({
            where: {
                sender_id: userId,
                created_at: { gte: today }
            },
            _count: true,
            _sum: {
                amount_gross: true,
                commission: true
            }
        });

        const settings = await getTransactionSettings();

        return {
            transactions_count: stats._count,
            total_sent: stats._sum.amount_gross
                ? stats._sum.amount_gross.toNumber
                    ? stats._sum.amount_gross.toNumber()
                    : Number(stats._sum.amount_gross)
                : 0,
            total_commission: stats._sum.commission
                ? stats._sum.commission.toNumber
                    ? stats._sum.commission.toNumber()
                    : Number(stats._sum.commission)
                : 0,
            remaining_limit: Math.max(
                0,
                settings.maxDailyTxPerWorker - stats._count
            )
        };
    } catch (err) {
        logger.error(`Error getting daily stats: ${err}`);
        errorHandler(
            new AppError(
                "Error getting daily stats",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return {
            transactions_count: 0,
            total_sent: 0,
            total_commission: 0,
            remaining_limit: 0
        };
    }
}

export async function getTotalNetByAllWorkers(userId: string, req: Request, res: Response) {
    try {
        // 1. Find all kiosks owned by this owner
        const kiosks = await prisma.kiosk.findMany({
            where: {
                owner_id: userId
            },
            select: { id: true }
        });

        if (kiosks.length === 0) {
            return 0;
        }

        const kioskIds = kiosks.map(k => k.id);

        // 2. Find all workers belonging to these kiosks
        const workers = await prisma.workerProfile.findMany({
            where: {
                kiosk_id: { in: kioskIds }
            },
            select: { user_id: true }
        });

        if (workers.length === 0) {
            return 0;
        }

        const workerUserIds = workers.map(w => w.user_id);

        // 3. Aggregate transactions where sender is one of these workers
        const result = await prisma.transaction.aggregate({
            where: {
                sender_id: { in: workerUserIds },
                type: "DEPOSIT",
            },
            _sum: {
                amount_net: true
            }
        });

        return result._sum.amount_net ? result._sum.amount_net.toNumber() : 0;

    } catch (err) {
        logger.error(`Error getting total net by all workers: ${err}`);
        errorHandler(
            new AppError(
                "Error getting total net by all workers",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return 0;
    }
}
