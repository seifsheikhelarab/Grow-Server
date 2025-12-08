import { errorHandler } from "./../../middlewares/error.middleware";
import { Request, Response } from "express";
import prisma from "../../prisma";
import {
	NotFoundError,
	AuthorizationError,
	BusinessLogicError,
	ErrorCode
} from "../../utils/response";
import logger from "../../utils/logger";

/**
 * Constants for transaction limits
 */
const TRANSACTION_FEE = 5;
const COMMISSION_AMOUNT = 5;
const MAX_TRANSACTION_AMOUNT = 100;
const MAX_DAILY_TXS_PER_WORKER = 150;
const MAX_DAILY_TXS_TO_CUSTOMER = 2;

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
	req: Request,
	res: Response
) {
	// Constraint 1: Amount <= 100
	if (amount > MAX_TRANSACTION_AMOUNT) {
		errorHandler(
			new BusinessLogicError(
				`Transaction amount cannot exceed ${MAX_TRANSACTION_AMOUNT}`,
				ErrorCode.INVALID_TRANSACTION_AMOUNT,
				{ max: MAX_TRANSACTION_AMOUNT, requested: amount }
			),
			req,
			res
		);
	}

	// Constraint 2: Daily Tx count to this specific customer < 2
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

	if (dailyTxsToCustomer >= MAX_DAILY_TXS_TO_CUSTOMER) {
		errorHandler(
			new BusinessLogicError(
				`Daily transaction limit to this customer (${MAX_DAILY_TXS_TO_CUSTOMER}) exceeded`,
				ErrorCode.DAILY_TX_TO_USER_LIMIT,
				{ max: MAX_DAILY_TXS_TO_CUSTOMER, current: dailyTxsToCustomer }
			),
			req,
			res
		);
	}

	// Constraint 3: Total Daily Tx count for this worker < 150
	const totalDailyTxs = await prisma.transaction.count({
		where: {
			sender_id: senderId,
			created_at: {
				gte: new Date(new Date().setHours(0, 0, 0, 0))
			}
		}
	});

	if (totalDailyTxs >= MAX_DAILY_TXS_PER_WORKER) {
		errorHandler(
			new BusinessLogicError(
				`Daily transaction limit (${MAX_DAILY_TXS_PER_WORKER}) exceeded`,
				ErrorCode.DAILY_LIMIT_EXCEEDED,
				{ max: MAX_DAILY_TXS_PER_WORKER, current: totalDailyTxs }
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
		await validateKiosk(kioskId, senderId, req, res);

		// Check constraints
		await checkConstraints(
			senderId,
			receiverPhone,
			kioskId,
			amount,
			req,
			res
		);

		// Calculate amounts
		const fee = TRANSACTION_FEE;
		const customerAmount = amount - fee;
		const commission = COMMISSION_AMOUNT;

		logger.info(
			`[TX] Starting transaction: ${amount} from ${sender.phone} to ${receiverPhone}`
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

			// Add commission to sender
			await tx.wallet.update({
				where: { user_id: senderId },
				data: { balance: { increment: commission } }
			});
			logger.info(`[TX] Added ${commission} commission to sender`);

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
					status: "COMPLETED"
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
		throw err;
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
	offset: number = 0
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
		throw err;
	}
}

/**
 * Get daily transaction stats.
 * 
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} The daily transaction statistics.
 */
export async function getDailyStats(userId: string) {
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
				MAX_DAILY_TXS_PER_WORKER - stats._count
			)
		};
	} catch (err) {
		logger.error(`Error getting daily stats: ${err}`);
		throw err;
	}
}
