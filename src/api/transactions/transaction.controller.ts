import { Request, Response } from 'express';
import * as transactionService from './transaction.service';
import { ResponseHandler, HttpStatus } from '../../utils/response';
import { asyncHandler } from '../../middlewares/error.middleware';
import logger from '../../utils/logger';

/**
 * Send points to customer
 */
export const sendPoints = asyncHandler(async (req: Request, res: Response) => {
  const senderId = req.user!.id;
  const { phone, amount } = req.body;
  // TODO: Get kioskId from request (need to determine which kiosk)
  const kioskId = req.body.kioskId || '';

  const result = await transactionService.sendPoints(
    senderId,
    phone,
    kioskId,
    amount
  );

  ResponseHandler.created(res, 'Points sent successfully', {
    transaction: {
      id: result.transaction.id,
      amount_gross: result.transaction.amount_gross.toString(),
      amount_net: result.transaction.amount_net.toString(),
      commission: result.transaction.commission.toString(),
      receiver_phone: result.transaction.receiver_phone,
      status: result.transaction.status,
      created_at: result.transaction.created_at,
    },
    due: {
      id: result.due.id,
      amount: result.due.amount.toString(),
    },
  });
});

/**
 * Get transaction history
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
    'Transaction history retrieved successfully',
    page,
    limit,
    result.total
  );
});

/**
 * Get daily transaction stats
 */
export const getDailyStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const stats = await transactionService.getDailyStats(userId);

  ResponseHandler.success(res, 'Daily stats retrieved successfully', stats);
});
