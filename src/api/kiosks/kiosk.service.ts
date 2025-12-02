import prisma from '../../prisma';
import {
  NotFoundError,
  AuthorizationError,
  ConflictError,
  BusinessLogicError,
  ErrorCode,
} from '../../utils/response';
import logger from '../../utils/logger';

/**
 * Create new kiosk
 */
export async function createKiosk(
  ownerId: string,
  name: string,
  gov: string,
  area: string
) {
  try {
    const kiosk = await prisma.kiosk.create({
      data: {
        owner_id: ownerId,
        name,
        gov,
        area,
        is_approved: false,
      },
    });

    logger.info(`Kiosk created: ${kiosk.id} by owner ${ownerId}`);
    return kiosk;
  } catch (err) {
    logger.error(`Error creating kiosk: ${err}`);
    throw err;
  }
}

/**
 * Invite worker to kiosk
 */
export async function inviteWorker(
  ownerId: string,
  kioskId: string,
  workerPhone: string
) {
  try {
    // Verify kiosk ownership
    const kiosk = await prisma.kiosk.findUnique({
      where: { id: kioskId },
    });

    if (!kiosk) {
      throw new NotFoundError('Kiosk not found');
    }

    if (kiosk.owner_id !== ownerId) {
      throw new AuthorizationError('You are not the owner of this kiosk');
    }

    // Check if worker user exists
    let worker = await prisma.user.findUnique({
      where: { phone: workerPhone },
    });

    if (!worker) {
      // Create user without password (for invited workers)
      worker = await prisma.user.create({
        data: {
          phone: workerPhone,
          role: 'WORKER',
        },
      });

      // Create wallet for new worker
      await prisma.wallet.create({
        data: {
          user_id: worker.id,
        },
      });

      logger.info(`New worker user created: ${worker.id}`);
    }

    if (worker.role !== 'WORKER') {
      throw new BusinessLogicError(
        'User must be a worker',
        ErrorCode.ROLE_NOT_ALLOWED
      );
    }

    // Check if already a worker at this kiosk
    const existingProfile = await prisma.workerProfile.findUnique({
      where: { user_id: worker.id },
    });

    if (existingProfile && existingProfile.kiosk_id === kioskId) {
      throw new ConflictError('Worker is already assigned to this kiosk');
    }

    // Create or update worker profile
    const profile = await prisma.workerProfile.upsert({
      where: { user_id: worker.id },
      update: {
        kiosk_id: kioskId,
        status: 'PENDING_INVITE',
      },
      create: {
        user_id: worker.id,
        kiosk_id: kioskId,
        status: 'PENDING_INVITE',
      },
    });

    logger.info(`Worker invited: ${worker.phone} to kiosk ${kioskId}`);
    return profile;
  } catch (err) {
    logger.error(`Error inviting worker: ${err}`);
    throw err;
  }
}

/**
 * Accept worker invitation
 */
export async function acceptInvitation(workerId: string) {
  try {
    const profile = await prisma.workerProfile.findUnique({
      where: { user_id: workerId },
    });

    if (!profile) {
      throw new NotFoundError('Worker invitation not found');
    }

    const updated = await prisma.workerProfile.update({
      where: { user_id: workerId },
      data: { status: 'ACTIVE' },
      include: {
        kiosk: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info(`Worker ${workerId} accepted invitation to kiosk ${profile.kiosk_id}`);
    return updated;
  } catch (err) {
    logger.error(`Error accepting invitation: ${err}`);
    throw err;
  }
}

/**
 * Get kiosk workers
 */
export async function getKioskWorkers(kioskId: string, ownerId: string) {
  try {
    // Verify ownership
    const kiosk = await prisma.kiosk.findUnique({
      where: { id: kioskId },
    });

    if (!kiosk) {
      throw new NotFoundError('Kiosk not found');
    }

    if (kiosk.owner_id !== ownerId) {
      throw new AuthorizationError('You are not the owner of this kiosk');
    }

    const workers = await prisma.workerProfile.findMany({
      where: { kiosk_id: kioskId },
      include: {
        user: {
          select: { id: true, phone: true, is_active: true },
        },
      },
    });

    return workers.map((w) => ({
      id: w.id,
      user_id: w.user_id,
      phone: w.user.phone,
      status: w.status,
      is_active: w.user.is_active,
    }));
  } catch (err) {
    logger.error(`Error getting kiosk workers: ${err}`);
    throw err;
  }
}

/**
 * Get kiosk dues
 */
export async function getKioskDues(kioskId: string, ownerId: string) {
  try {
    // Verify ownership
    const kiosk = await prisma.kiosk.findUnique({
      where: { id: kioskId },
    });

    if (!kiosk) {
      throw new NotFoundError('Kiosk not found');
    }

    if (kiosk.owner_id !== ownerId) {
      throw new AuthorizationError('You are not the owner of this kiosk');
    }

    const dues = await prisma.kioskDue.findMany({
      where: { kiosk_id: kioskId },
      orderBy: { created_at: 'desc' },
    });

    const totalDue = dues.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalPaid = dues.filter((d) => d.is_paid).length;

    return {
      dues: dues.map((d) => ({
        id: d.id,
        amount: d.amount.toString(),
        is_paid: d.is_paid,
        created_at: d.created_at,
      })),
      summary: {
        total_dues: dues.length,
        total_amount: totalDue.toString(),
        paid_count: totalPaid,
        pending_count: dues.length - totalPaid,
      },
    };
  } catch (err) {
    logger.error(`Error getting kiosk dues: ${err}`);
    throw err;
  }
}

/**
 * Get user's kiosks
 */
export async function getUserKiosks(ownerId: string) {
  try {
    const kiosks = await prisma.kiosk.findMany({
      where: { owner_id: ownerId },
      include: {
        _count: {
          select: { workers: true, transactions: true },
        },
      },
    });

    return kiosks.map((k) => ({
      id: k.id,
      name: k.name,
      gov: k.gov,
      area: k.area,
      is_approved: k.is_approved,
      workers_count: k._count.workers,
      transactions_count: k._count.transactions,
    }));
  } catch (err) {
    logger.error(`Error getting user kiosks: ${err}`);
    throw err;
  }
}
