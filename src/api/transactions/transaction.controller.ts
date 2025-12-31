import { Request, Response } from "express";
import * as transactionService from "./transaction.service.js";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

/**
 * Send points to customer.
 *
 * @param {Request} req - The Express request object containing phone, amount, and kioskId in body.
 * @param {Response} res - The Express response object.
 */
export const sendPoints = asyncHandler(async (req: Request, res: Response) => {
    const senderId = req.user!.id;

    const { phone, amount, kioskId, workerProfileId } = req.body;

    const result = await transactionService.sendPoints(
        senderId,
        phone,
        kioskId,
        amount,
        workerProfileId
    );

    ResponseHandler.created(res, "Points sent successfully", {
        transaction: {
            id: result.transaction.id,
            amount_gross: result.transaction.amount_gross.toString(),
            amount_net: result.transaction.amount_net.toString(),
            commission: result.transaction.commission.toString(),
            receiver_phone: result.transaction.receiver_phone,
            status: result.transaction.status,
            created_at: result.transaction.created_at
        },
        due: {
            id: result.due.id,
            amount: result.due.amount.toString()
        }
    });
});

/**
 * Get transaction history.
 *
 * @param {Request} req - The Express request object containing page and limit in query.
 * @param {Response} res - The Express response object.
 */
export const getHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await transactionService.getTransactionHistory(
        userId,
        limit,
        offset
    );

    ResponseHandler.paginated(
        res,
        result.transactions,
        "Transaction history retrieved successfully",
        page,
        limit,
        result.total
    );
});

/**
 * Get daily transaction stats.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getDailyStats = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.id;

        const stats = await transactionService.getDailyStats(userId);

        ResponseHandler.success(
            res,
            "Daily stats retrieved successfully",
            stats
        );
    }
);
