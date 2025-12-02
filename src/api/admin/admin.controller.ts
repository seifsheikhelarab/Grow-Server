import { Request, Response } from 'express';
import * as adminService from './admin.service';
import { ResponseHandler } from '../../utils/response';
import { asyncHandler } from '../../middlewares/error.middleware';
import logger from '../../utils/logger';

/**
 * Get admin dashboard
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const filter = (req.query.filter as '1d' | '7d' | '30d') || '7d';

  const stats = await adminService.getDashboardStats(filter);

  ResponseHandler.success(res, 'Dashboard stats retrieved successfully', stats);
});

/**
 * Get pending kiosks
 */
export const getPendingKiosks = asyncHandler(async (req: Request, res: Response) => {
  const kiosks = await adminService.getPendingKiosks();

  ResponseHandler.success(res, 'Pending kiosks retrieved successfully', {
    kiosks,
  });
});

/**
 * Approve kiosk
 */
export const approveKiosk = asyncHandler(async (req: Request, res: Response) => {
  const { kioskId } = req.body;

  const kiosk = await adminService.approveKiosk(kioskId);

  ResponseHandler.success(res, 'Kiosk approved successfully', {
    id: kiosk.id,
    name: kiosk.name,
    is_approved: kiosk.is_approved,
  });
});

/**
 * Get pending redemptions
 */
export const getPendingRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const redemptions = await adminService.getPendingRedemptions();

  ResponseHandler.success(res, 'Pending redemptions retrieved successfully', {
    redemptions,
  });
});

/**
 * Process redemption
 */
export const processRedemption = asyncHandler(async (req: Request, res: Response) => {
  const { reqId, action, note } = req.body;

  const redemption = await adminService.processRedemption(reqId, action, note);

  ResponseHandler.success(res, `Redemption ${action.toLowerCase()}ed successfully`, {
    id: redemption.id,
    status: redemption.status,
    user_id: redemption.user_id,
    amount: redemption.amount.toString(),
  });
});

/**
 * Collect due
 */
export const collectDue = asyncHandler(async (req: Request, res: Response) => {
  const { dueId } = req.body;

  const due = await adminService.collectDue(dueId);

  ResponseHandler.success(res, 'Due collected successfully', {
    id: due.id,
    amount: due.amount.toString(),
    is_paid: due.is_paid,
  });
});
