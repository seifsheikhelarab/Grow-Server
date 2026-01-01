
import prisma from "../../prisma.js";
import {
    NotFoundError,
    AuthorizationError,
    BusinessLogicError,
    ErrorCode
} from "../../utils/response.js";
import logger from "../../utils/logger.js";
import * as notificationService from "../notifications/notifications.service.js";

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
 * @returns {Promise<object>} The validated user object.
 */
async function validateSender(senderId: string) {
    const user = await prisma.user.findUnique({
        where: { id: senderId },
        include: { worker_profiles: true }
    });

    if (!user) {
        throw new NotFoundError("User not found");
    }

    if (!user.is_active) {
        throw new BusinessLogicError(
            "User account is not active",
            ErrorCode.WORKER_NOT_ACTIVE
        );
    }

    if (!user.is_verified) {
        throw new BusinessLogicError(
            "User account is not verified",
            ErrorCode.WORKER_NOT_ACTIVE
        );
    }

    if (user.role !== "WORKER" && user.role !== "OWNER") {
        throw new AuthorizationError(
            "Only workers and owners can send points"
        );
    }

    // Check if worker has at least one active profile
    if (user.role === "WORKER" && user.worker_profiles) {
        const hasActiveProfile = user.worker_profiles.some(
            (p) => p.status === "ACTIVE"
        );
        if (!hasActiveProfile) {
            throw new BusinessLogicError(
                "Worker has no active profile",
                ErrorCode.WORKER_NOT_ACTIVE
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
 * @returns {Promise<object>} The validated kiosk object.
 */
async function validateKiosk(kioskId: string, senderId: string) {
    const kiosk = await prisma.kiosk.findUnique({
        where: { id: kioskId }
    });

    if (!kiosk) {
        throw new NotFoundError("Kiosk not found");
    }

    // Verify sender is owner or worker of this kiosk
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        include: { worker_profiles: true }
    });

    if (sender?.role === "OWNER" && kiosk.owner_id !== senderId) {
        throw new AuthorizationError("You are not the owner of this kiosk");
    }

    if (sender?.role === "WORKER") {
        const hasProfileForKiosk = sender.worker_profiles?.some(
            (p) => p.kiosk_id === kioskId && p.status === "ACTIVE"
        );
        if (!hasProfileForKiosk) {
            throw new AuthorizationError("You are not assigned to this kiosk");
        }
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
    }
) {
    const { maxTransactionAmount, maxDailyTxToCustomer, maxDailyTxPerWorker } =
        settings;

    // Constraint 1: Amount <= maxTransactionAmount
    if (amount > maxTransactionAmount) {
        throw new BusinessLogicError(
            `Transaction amount cannot exceed ${maxTransactionAmount}`,
            ErrorCode.INVALID_TRANSACTION_AMOUNT,
            { max: maxTransactionAmount, requested: amount }
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
        throw new BusinessLogicError(
            `Daily transaction limit to this customer (${maxDailyTxToCustomer}) exceeded`,
            ErrorCode.DAILY_TX_TO_USER_LIMIT,
            { max: maxDailyTxToCustomer, current: dailyTxsToCustomer }
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
        throw new BusinessLogicError(
            `Daily transaction limit (${maxDailyTxPerWorker}) exceeded`,
            ErrorCode.DAILY_LIMIT_EXCEEDED,
            { max: maxDailyTxPerWorker, current: totalDailyTxs }
        );
    }
}

/**
 * Send points - Core Logic.
 *
 * @param {string} senderId - The ID of the sender.
 * @param {string} receiverPhone - The phone number of the receiver.
 * @param {string} kioskId - The ID of the kiosk.
 * @param {number} amount - The transaction amount.
 * @returns {Promise<object>} The transaction result containing transaction record and due.
 */
export async function sendPoints(
    senderId: string,
    receiverPhone: string,
    kioskId: string,
    amount: number
) {
    // Validate sender
    const sender = await validateSender(senderId);

    // Validate kiosk
    const kiosk = await validateKiosk(kioskId, senderId);

    // Deduce worker profile if sender is a worker
    let workerProfileId: string | null = null;
    if (sender.role === "WORKER") {
        const activeProfile = sender.worker_profiles.find(
            (p) => p.kiosk_id === kioskId && p.status === "ACTIVE"
        );
        // validateKiosk already ensures that if the sender is a WORKER, they have an active profile for this kiosk.
        if (activeProfile) {
            workerProfileId = activeProfile.id;
        }
    }

    // Get settings
    const settings = await getTransactionSettings();

    // Check constraints
    await checkConstraints(
        senderId,
        receiverPhone,
        kioskId,
        amount,
        settings
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
            // No Goal: Pay Worker immediately and send 
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
                workerprofile_id: workerProfileId || null,
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

    // Notify worker: Transaction completed
    await notificationService.notifyWorkerTransaction(
        senderId,
        amount.toString(),
        receiverPhone
    );

    // Notify owner: Transaction completed (if worker sent it)
    if (sender.role === "WORKER") {
        await notificationService.notifyOwnerTransaction(
            kiosk.owner_id,
            sender.full_name,
            amount.toString(),
            receiverPhone
        );
    }

    return result;
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
    workerProfileId?: string
) {
    const whereClause: any = {
        OR: [{ sender_id: userId }, { receiver_id: userId }]
    };

    if (workerProfileId) {
        whereClause.workerprofile_id = workerProfileId;
        delete whereClause.OR;
        whereClause.sender_id = userId;
        whereClause.workerprofile_id = workerProfileId;
    }

    const transactions = await prisma.transaction.findMany({
        where: whereClause,
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
        where: whereClause
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
}

/**
 * Get daily transaction stats.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} The daily transaction statistics.
 */
export async function getDailyStats(
    userId: string,
    workerProfileId?: string
) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereClause: any = {
        sender_id: userId,
        created_at: { gte: today }
    };

    if (workerProfileId) {
        whereClause.workerprofile_id = workerProfileId;
    }

    const stats = await prisma.transaction.aggregate({
        where: whereClause,
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
}

/**
 * Get total net amount generated by all workers of an owner.
 *
 * @param {string} userId - The ID of the owner.
 * @returns {Promise<number>} Total net amount.
 */
export async function getTotalNetByAllWorkers(
    userId: string
) {
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

    const kioskIds = kiosks.map((k) => k.id);

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

    const workerUserIds = workers.map((w) => w.user_id);

    // 3. Aggregate transactions where sender is one of these workers
    const result = await prisma.transaction.aggregate({
        where: {
            sender_id: { in: workerUserIds },
            type: "DEPOSIT"
        },
        _sum: {
            amount_net: true
        }
    });

    return result._sum.amount_net ? result._sum.amount_net.toNumber() : 0;
}
