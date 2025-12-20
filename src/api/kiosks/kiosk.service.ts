import prisma from "../../prisma.js";
import {
    NotFoundError,
    AuthorizationError,
    ConflictError,
    BusinessLogicError,
    ErrorCode,
    AppError
} from "../../utils/response.js";
import logger from "../../utils/logger.js";
import { errorHandler } from "../../middlewares/error.middleware.js";
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
    location: string,
    req: Request,
    res: Response
): Promise<{ id: string; name: string; kiosk_type: string; location: string }> {
    try {
        const existingKiosk = await prisma.kiosk.findFirst({
            where: {
                owner_id: ownerId,
                name: name
            }
        });

        if (existingKiosk) {
            errorHandler(
                new ConflictError("Kiosk with this name already exists"),
                req,
                res
            );
        }

        const kiosks = await prisma.kiosk.findMany({
            where: { owner_id: ownerId }
        });

        const maxKiosksSetting = await prisma.systemSetting.findUnique({
            where: { key: "max_kiosks" }
        });
        const maxKiosks = Number(maxKiosksSetting?.value || 0);

        if (maxKiosks > 0 && kiosks.length >= maxKiosks) {
            errorHandler(
                new BusinessLogicError(
                    "You have reached the maximum number of kiosks",
                    ErrorCode.KIOSK_NOT_APPROVED
                ),
                req,
                res
            );
        }

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
        errorHandler(
            new AppError("Error creating kiosk", 500, ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
        return { id: "", name: "", kiosk_type: "", location: "" };
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
): Promise<{ id: string; user_id: string; kiosk_id: string; status: string }> {
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
            return { id: "", user_id: "", kiosk_id: "", status: "" };
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return { id: "", user_id: "", kiosk_id: "", status: "" };
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
            return { id: "", user_id: "", kiosk_id: "", status: "" };
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
            return { id: "", user_id: "", kiosk_id: "", status: "" };
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
        errorHandler(
            new AppError(
                "Error inviting worker",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return { id: "", user_id: "", kiosk_id: "", status: "" };
    }
}

/**
 * Get worker invitations.
 *
 * @param {string} workerId - The ID of the worker.
 * @returns {Promise<object[]>} List of invitations.
 */
export async function getWorkerInvitations(
    workerId: string,
    req: Request,
    res: Response
) {
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
        errorHandler(
            new AppError(
                "Error getting worker invitations",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return [];
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
    action: string,
    req: Request,
    res: Response
) {
    try {
        const profile = await prisma.workerProfile.findUnique({
            where: {
                id: invitationId,
                user_id: workerId,
                status: "PENDING_INVITE"
            }
        });

        if (!profile) {
            errorHandler(
                new NotFoundError("Worker invitation not found"),
                req,
                res
            );
        }

        const updated = await prisma.workerProfile.update({
            where: {
                id: invitationId,
                user_id: workerId,
                status: "PENDING_INVITE"
            },
            data: { status: action },
            include: {
                kiosk: {
                    select: { id: true, name: true }
                }
            }
        });

        logger.info(
            `Worker ${workerId} changed invitation status to ${action} to kiosk ${profile.kiosk_id}`
        );
        return updated;
    } catch (err) {
        logger.error(`Error changing invitation status: ${err}`);
        errorHandler(
            new AppError(
                "Error changing invitation status",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return null;
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
        errorHandler(
            new AppError(
                "Error getting kiosk workers",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return [];
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
        errorHandler(
            new AppError(
                "Error getting kiosk dues",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return {
            dues: [],
            summary: {
                total_dues: 0,
                total_amount: "0",
                paid_count: 0,
                pending_count: 0
            }
        };
    }
}

/**
 * Get user's kiosks.
 *
 * @param {string} ownerId - The ID of the owner.
 * @returns {Promise<object[]>} List of kiosks.
 */
export async function getUserKiosks(
    ownerId: string,
    req: Request,
    res: Response
) {
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
        errorHandler(
            new AppError(
                "Error getting user kiosks",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return [];
    }
}

/**
 * Remove worker from kiosk.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} workerId - The ID of the worker.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The updated kiosk.
 */
export async function removeWorker(
    kioskId: string,
    workerId: string,
    req: Request,
    res: Response
) {
    try {
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

        if (kiosk.owner_id !== req.user!.id) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
        }

        const worker = await prisma.workerProfile.findUnique({
            where: { id: workerId }
        });

        if (!worker) {
            errorHandler(new NotFoundError("Worker not found"), req, res);
        }

        await prisma.workerProfile.delete({
            where: { user_id: workerId }
        });

        const updated = await prisma.kiosk.update({
            where: { id: kioskId },
            data: { workers: { disconnect: { id: workerId } } }
        });

        logger.info(`Worker ${workerId} removed from kiosk ${kioskId}`);
        return updated;
    } catch (err) {
        logger.error(`Error removing worker: ${err}`);
        errorHandler(
            new AppError(
                "Error removing worker",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return null;
    }
}
