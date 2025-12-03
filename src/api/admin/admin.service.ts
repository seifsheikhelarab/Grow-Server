import prisma from '../../prisma';
import {
  NotFoundError,
  BusinessLogicError,
  ErrorCode,
} from '../../utils/response';
import logger from '../../utils/logger';
import { errorHandler } from '../../middlewares/error.middleware';
import { Request, Response } from 'express';

/**
 * Get admin dashboard stats
 */
export async function getDashboardStats(filter: '1d' | '7d' | '30d' = '7d', req: Request, res: Response) {
  try {
    const now = new Date();
    let startDate = new Date();

    if (filter === '1d') {
      startDate.setHours(-24, 0, 0, 0);
    } else if (filter === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    // Total users
    const totalUsers = await prisma.user.count();

    // Users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    // Transactions in period
    const transactions = await prisma.transaction.aggregate({
      where: { created_at: { gte: startDate } },
      _count: true,
      _sum: {
        amount_gross: true,
        amount_net: true,
        commission: true,
      },
    });

    // Total points in circulation (in wallets + shadow wallets)
    const walletBalance = await prisma.wallet.aggregate({
      _sum: { balance: true },
    });

    const shadowBalance = await prisma.shadowWallet.aggregate({
      _sum: { balance: true },
    });

    // Unpaid dues
    const unpaidDues = await prisma.kioskDue.aggregate({
      where: { is_paid: false },
      _count: true,
      _sum: { amount: true },
    });

    // Pending kiosks
    const pendingKiosks = await prisma.kiosk.count({
      where: { is_approved: false },
    });

    // Pending redemptions
    const pendingRedemptions = await prisma.redemptionRequest.count({
      where: { status: 'PENDING' },
    });

    return {
      period: filter,
      summary: {
        total_users: totalUsers,
        total_wallets_balance: walletBalance._sum.balance ? (walletBalance._sum.balance.toNumber ? walletBalance._sum.balance.toNumber() : Number(walletBalance._sum.balance)) : 0,
        total_shadow_balance: shadowBalance._sum.balance ? (shadowBalance._sum.balance.toNumber ? shadowBalance._sum.balance.toNumber() : Number(shadowBalance._sum.balance)) : 0,
        total_circulation: (Number(walletBalance._sum.balance || 0) + (Number(shadowBalance._sum.balance || 0))),
      },
      transactions: {
        count: transactions._count,
        total_gross: transactions._sum.amount_gross ? (transactions._sum.amount_gross.toNumber ? transactions._sum.amount_gross.toNumber() : Number(transactions._sum.amount_gross)) : 0,
        total_net: transactions._sum.amount_net ? (transactions._sum.amount_net.toNumber ? transactions._sum.amount_net.toNumber() : Number(transactions._sum.amount_net)) : 0,
        total_commission: transactions._sum.commission ? (transactions._sum.commission.toNumber ? transactions._sum.commission.toNumber() : Number(transactions._sum.commission)) : 0,
      },
      users_by_role: usersByRole.map((r) => ({
        role: r.role,
        count: r._count,
      })),
      pending_items: {
        kiosks: pendingKiosks,
        redemptions: pendingRedemptions,
      },
      dues: {
        unpaid_count: unpaidDues._count,
        unpaid_amount: unpaidDues._sum.amount ? (unpaidDues._sum.amount.toNumber ? unpaidDues._sum.amount.toNumber() : Number(unpaidDues._sum.amount)) : 0,
      },
    };
  } catch (err) {
    logger.error(`Error getting dashboard stats: ${err}`);
    throw err;
  }
}

/**
 * Approve kiosk
 */
export async function approveKiosk(kioskId: string, req: Request, res: Response) {
  try {
    const kiosk = await prisma.kiosk.findUnique({
      where: { id: kioskId },
    });

    if (!kiosk) {
      errorHandler(new NotFoundError('Kiosk not found'), req, res);
    }

    if (kiosk.is_approved) {
      errorHandler(new BusinessLogicError('Kiosk is already approved', ErrorCode.RESOURCE_ALREADY_EXISTS), req, res);
    }

    const updated = await prisma.kiosk.update({
      where: { id: kioskId },
      data: { is_approved: true },
    });

    logger.info(`Kiosk approved: ${kioskId}`);
    return updated;
  } catch (err) {
    logger.error(`Error approving kiosk: ${err}`);
    throw err;
  }
}

/**
 * Get pending kiosks
 */
export async function getPendingKiosks() {
  try {
    const kiosks = await prisma.kiosk.findMany({
      where: { is_approved: false },
      include: {
        owner: {
          select: { phone: true },
        },
        _count: {
          select: { workers: true, transactions: true },
        },
      },
    });

    return kiosks.map((k) => ({
      id: k.id,
      name: k.name,
      kiosk_type: k.kiosk_type,
      location: k.location,
      owner_phone: k.owner.phone,
      workers_count: k._count.workers,
      transactions_count: k._count.transactions,
    }));
  } catch (err) {
    logger.error(`Error getting pending kiosks: ${err}`);
    throw err;
  }
}

/**
 * Get pending redemptions
 */
export async function getPendingRedemptions() {
  try {
    const redemptions = await prisma.redemptionRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: { phone: true, role: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return redemptions.map((r) => ({
      id: r.id,
      user_phone: r.user.phone,
      user_role: r.user.role,
      amount: r.amount.toString(),
      method: r.method,
      details: r.details,
      created_at: r.created_at,
    }));
  } catch (err) {
    logger.error(`Error getting pending redemptions: ${err}`);
    throw err;
  }
}

/**
 * Process redemption request
 */
export async function processRedemption(
  redemptionId: string,
  action: 'APPROVE' | 'REJECT',
  req: Request,
  res: Response,
  note?: string,
) {
  try {
    const redemption = await prisma.redemptionRequest.findUnique({
      where: { id: redemptionId },
    });

    if (!redemption) {
      errorHandler(new NotFoundError('Redemption request not found'), req, res);
    }

    if (redemption.status !== 'PENDING') {
      errorHandler(new BusinessLogicError(
        `Redemption is already ${redemption.status.toLowerCase()}`,
        ErrorCode.RESOURCE_CONFLICT
      ), req, res);
    }

    const status = action === 'APPROVE' ? 'COMPLETED' : 'REJECTED';

    const updated = await prisma.$transaction(async (tx) => {
      // If rejected, refund points to user
      if (action === 'REJECT') {
        const amount = redemption.amount.toNumber ? redemption.amount.toNumber() : Number(redemption.amount);
        await tx.wallet.update({
          where: { user_id: redemption.user_id },
          data: { balance: { increment: amount } },
        });
      }

      return await tx.redemptionRequest.update({
        where: { id: redemptionId },
        data: { status, admin_note: note },
      });
    });

    logger.info(
      `Redemption ${action.toLowerCase()}: ${redemptionId}`
    );
    return updated;
  } catch (err) {
    logger.error(`Error processing redemption: ${err}`);
    throw err;
  }
}

/**
 * Collect due
 */
export async function collectDue(dueId: string, req: Request, res: Response) {
  try {
    const due = await prisma.kioskDue.findUnique({
      where: { id: dueId },
    });

    if (!due) {
      errorHandler(new NotFoundError('Due not found'), req, res);
    }

    if (due.is_paid) {
      errorHandler(new BusinessLogicError('Due is already paid', ErrorCode.RESOURCE_CONFLICT), req, res);
    }

    const updated = await prisma.kioskDue.update({
      where: { id: dueId },
      data: { is_paid: true },
    });

    logger.info(`Due collected: ${dueId}`);
    return updated;
  } catch (err) {
    logger.error(`Error collecting due: ${err}`);
    throw err;
  }
}
