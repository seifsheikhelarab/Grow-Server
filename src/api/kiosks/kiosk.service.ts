import prisma from "../../prisma";
import {
    NotFoundError,
    AuthorizationError,
    ConflictError,
    BusinessLogicError,
    ErrorCode
} from "../../utils/response";
import logger from "../../utils/logger";
import { errorHandler } from "../../middlewares/error.middleware";
import { Request, Response } from "express";

/**
 * Create new kiosk.
 *
 * @param {string} ownerId - The ID of the owner.
 * @param {string} name - The name of the kiosk.
 * @param {string} kiosk_type - The type of the kiosk.
 * @param {string} location - The location of the kiosk.
 * @returns {Promise<object>} The created kiosk.
 */
export async function createKiosk(
    ownerId: string,
    name: string,
    kiosk_type: string,
    location: string
) {
    try {
        const kiosk = await prisma.kiosk.create({
            data: {
                owner_id: ownerId,
                name,
                kiosk_type,
                location
            }
        });

        logger.info(`Kiosk created: ${kiosk.id} by owner ${ownerId}`);
        return kiosk;
    } catch (err) {
        logger.error(`Error creating kiosk: ${err}`);
        throw err;
    }
}

/**
 * Invite worker to kiosk.
 *
 * @param {string} ownerId - The ID of the owner.
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} workerPhone - The phone number of the worker.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The created or updated worker profile.
 */
export async function inviteWorker(
    ownerId: string,
    kioskId: string,
    workerPhone: string,
    req: Request,
    res: Response
) {
    try {
        // Verify kiosk ownership
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId }
        });

        if (!kiosk) {
            errorHandler(
                new NotFoundError("Kiosk not found or not approved"),
                req,
                res
            );
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
        }

        // Check if worker user exists
        let worker = await prisma.user.findUnique({
            where: { phone: workerPhone }
        });

        if (!worker) {
            // Create user without password (for invited workers)
            worker = await prisma.user.create({
                data: {
                    phone: workerPhone,
                    full_name: "Invited Worker", // Placeholder until they sign up properly
                    role: "WORKER"
                }
            });

            // Create wallet for new worker
            await prisma.wallet.create({
                data: {
                    user_id: worker.id
                }
            });

            logger.info(`New worker user created: ${worker.id}`);
        }

        if (worker.role !== "WORKER") {
            errorHandler(
                new BusinessLogicError(
                    "User must be a worker",
                    ErrorCode.ROLE_NOT_ALLOWED
                ),
                req,
                res
            );
        }

        // Check if already a worker at this kiosk
        const existingProfile = await prisma.workerProfile.findUnique({
            where: { user_id: worker.id }
        });

        if (existingProfile && existingProfile.kiosk_id === kioskId) {
            errorHandler(
                new ConflictError("Worker is already assigned to this kiosk"),
                req,
                res
            );
        }

        // Create or update worker profile
        const profile = await prisma.workerProfile.upsert({
            where: { user_id: worker.id },
            update: {
                kiosk_id: kioskId,
                status: "PENDING_INVITE"
            },
            create: {
                user_id: worker.id,
                kiosk_id: kioskId,
                status: "PENDING_INVITE"
            }
        });

        logger.info(`Worker invited: ${worker.phone} to kiosk ${kioskId}`);
        return profile;
    } catch (err) {
        logger.error(`Error inviting worker: ${err}`);
        throw err;
    }
}

/**
 * Get worker invitations.
 *
 * @param {string} workerId - The ID of the worker.
 * @returns {Promise<object[]>} List of invitations.
 */
export async function getWorkerInvitations(workerId: string) {
    try {
        const invitations = await prisma.workerProfile.findMany({
            where: { user_id: workerId },
            include: {
                kiosk: {
                    select: { id: true, name: true }
                }
            }
        });

        return invitations.map((i) => ({
            id: i.id,
            kiosk_id: i.kiosk_id,
            kiosk_name: i.kiosk.name,
            worker_id: i.user_id,
            status: i.status
        }));
    } catch (err) {
        logger.error(`Error getting worker invitations: ${err}`);
        throw err;
    }
}

/**
 * Accept worker invitation.
 *
 * @param {string} invitationId - The ID of the invitation.
 * @param {string} workerId - The ID of the worker.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The updated worker profile.
 */
export async function acceptInvitation(
    invitationId: string,
    workerId: string,
    req: Request,
    res: Response
) {
    try {
        const profile = await prisma.workerProfile.findUnique({
            where: { id: invitationId, user_id: workerId }
        });

        if (!profile) {
            errorHandler(
                new NotFoundError("Worker invitation not found"),
                req,
                res
            );
        }

        const updated = await prisma.workerProfile.update({
            where: { id: invitationId, user_id: workerId },
            data: { status: "ACTIVE" },
            include: {
                kiosk: {
                    select: { id: true, name: true }
                }
            }
        });

        logger.info(
            `Worker ${workerId} accepted invitation to kiosk ${profile.kiosk_id}`
        );
        return updated;
    } catch (err) {
        logger.error(`Error accepting invitation: ${err}`);
        throw err;
    }
}

/**
 * Get kiosk workers.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} ownerId - The ID of the owner.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[]>} List of workers.
 */
export async function getKioskWorkers(
    kioskId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
    try {
        // Verify ownership
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId }
        });

        if (!kiosk) {
            errorHandler(
                new NotFoundError("Kiosk not found or not approved"),
                req,
                res
            );
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
        }

        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            include: {
                user: {
                    select: { id: true, phone: true, is_active: true }
                }
            }
        });

        return workers.map((w) => ({
            id: w.id,
            user_id: w.user_id,
            phone: w.user.phone,
            status: w.status,
            is_active: w.user.is_active
        }));
    } catch (err) {
        logger.error(`Error getting kiosk workers: ${err}`);
        throw err;
    }
}

/**
 * Get kiosk dues.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} ownerId - The ID of the owner.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} Dues and summary.
 */
export async function getKioskDues(
    kioskId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
    try {
        // Verify ownership
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId }
        });

        if (!kiosk) {
            errorHandler(
                new NotFoundError("Kiosk not found or not approved"),
                req,
                res
            );
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
        }

        const dues = await prisma.kioskDue.findMany({
            where: { kiosk_id: kioskId },
            orderBy: { created_at: "desc" }
        });

        const totalDue = dues.reduce((sum, d) => sum + Number(d.amount), 0);
        const totalPaid = dues.filter((d) => d.is_paid).length;

        return {
            dues: dues.map((d) => ({
                id: d.id,
                amount: d.amount.toString(),
                is_paid: d.is_paid,
                created_at: d.created_at
            })),
            summary: {
                total_dues: dues.length,
                total_amount: totalDue.toString(),
                paid_count: totalPaid,
                pending_count: dues.length - totalPaid
            }
        };
    } catch (err) {
        logger.error(`Error getting kiosk dues: ${err}`);
        throw err;
    }
}

/**
 * Get user's kiosks.
 *
 * @param {string} ownerId - The ID of the owner.
 * @returns {Promise<object[]>} List of kiosks.
 */
export async function getUserKiosks(ownerId: string) {
    try {
        const kiosks = await prisma.kiosk.findMany({
            where: { owner_id: ownerId },
            include: {
                _count: {
                    select: { workers: true, transactions: true }
                }
            }
        });

        return kiosks.map((k) => ({
            id: k.id,
            name: k.name,
            kiosk_type: k.kiosk_type,
            location: k.location,
            workers_count: k._count.workers,
            transactions_count: k._count.transactions
        }));
    } catch (err) {
        logger.error(`Error getting user kiosks: ${err}`);
        throw err;
    }
}
