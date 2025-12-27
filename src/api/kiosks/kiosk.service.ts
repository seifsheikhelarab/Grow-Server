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
import * as notificationService from "../notifications/notifications.service.js";

/**
 * Create new kiosk.
 *
 * @param {string} ownerId - The ID of the owner.
 * @param {string} name - The name of the kiosk.
 * @param {string} kiosk_type - The type of the kiosk.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The created kiosk.
 */
export async function createKiosk(
    ownerId: string,
    name: string,
    kiosk_type: string,
    req: Request,
    res: Response
): Promise<{ id: string; name: string; kiosk_type: string }> {
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
            return { id: "", name: "", kiosk_type: "" };
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
            return { id: "", name: "", kiosk_type: "" };
        }

        const kiosk = await prisma.kiosk.create({
            data: {
                owner_id: ownerId,
                name,
                kiosk_type
            }
        });

        logger.info(`Kiosk created: ${kiosk.id} by owner ${ownerId}`);

        // Notify owner: Kiosk created
        await notificationService.notifyOwnerKioskCreated(ownerId, name);

        return kiosk;
    } catch (err) {
        logger.error(`Error creating kiosk: ${err}`);
        errorHandler(
            new AppError("Error creating kiosk", 500, ErrorCode.INTERNAL_ERROR),
            req,
            res
        );
        return { id: "", name: "", kiosk_type: "" };
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
    name: string,
    req: Request,
    res: Response
): Promise<{
    id: string;
    user_id: string;
    name: string;
    kiosk_id: string;
    status: string;
}> {
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
            return { id: "", user_id: "", kiosk_id: "", name: "", status: "" };
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return { id: "", user_id: "", kiosk_id: "", name: "", status: "" };
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
                    full_name: name,
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
            return { id: "", user_id: "", kiosk_id: "", name: "", status: "" };
        }

        // Check if already a worker at this kiosk
        const existingProfile = await prisma.workerProfile.findFirst({
            where: { user_id: worker.id, kiosk_id: kioskId }
        });

        if (existingProfile && existingProfile.kiosk_id === kioskId) {
            errorHandler(
                new ConflictError("Worker is already assigned to this kiosk"),
                req,
                res
            );
            return { id: "", user_id: "", kiosk_id: "", name: "", status: "" };
        }

        // Create worker profile for this kiosk
        const profile = await prisma.workerProfile.create({
            data: {
                user_id: worker.id,
                kiosk_id: kioskId,
                status: "PENDING_INVITE",
                name
            }
        });

        logger.info(`Worker invited: ${worker.phone} to kiosk ${kioskId}`);

        // Notify owner: Invitation sent
        await notificationService.notifyOwnerInvitationSent(
            ownerId,
            name,
            kiosk.name
        );

        // Notify worker: New invitation
        await notificationService.notifyWorkerNewInvitation(
            worker.id,
            kiosk.name,
            "Owner"
        );

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
        return { id: "", user_id: "", kiosk_id: "", name: "", status: "" };
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
                    include: {
                        owner: {
                            select: { full_name: true }
                        }
                    }
                }
            }
        });

        return invitations.map((i) => ({
            id: i.id,
            kiosk_id: i.kiosk_id,
            kiosk_name: i.kiosk.name,
            worker_id: i.user_id,
            owner_name: i.kiosk.owner.full_name,
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
        const profile = await prisma.workerProfile.findFirst({
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
            return null;
        }

        const updated = await prisma.workerProfile.update({
            where: {
                id: invitationId
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

        // Get kiosk owner to notify
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: profile.kiosk_id },
            include: { owner: true }
        });

        if (kiosk) {
            const worker = await prisma.user.findUnique({
                where: { id: workerId }
            });
            const workerName = worker?.full_name || "Worker";
            await notificationService.notifyOwnerInvitationResponse(
                kiosk.owner_id,
                workerName,
                kiosk.name,
                action === "ACTIVE"
            );
        }

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
            return [];
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return [];
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
            name: w.name,
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

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
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
            return null;
        }

        if (kiosk.owner_id !== req.user!.id) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return null;
        }

        const worker = await prisma.workerProfile.findUnique({
            where: { id: workerId }
        });

        if (!worker) {
            errorHandler(new NotFoundError("Worker not found"), req, res);
            return null;
        }

        const updated = await prisma.kiosk.update({
            where: { id: kioskId },
            data: {
                workers: {
                    delete: { id: workerId }
                }
            }
        });

        logger.info(`Worker ${workerId} removed from kiosk ${kioskId}`);

        // Notify owner: Worker left kiosk
        await notificationService.notifyOwnerWorkerLeft(
            req.user!.id,
            worker.name,
            kiosk.name
        );

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

/**
 * Get Kiosk Details
 * @param {string} kioskId - The ID of the kiosk.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The kiosk details.
 */
export async function getKioskDetails(
    kioskId: string,
    ownerId: string,
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
            return null;
        }

        if (ownerId !== kiosk.owner_id) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return null;
        }

        const dues = await prisma.kioskDue.findMany({
            where: {
                kiosk_id: kioskId,
                created_at: {
                    gte: new Date(new Date().setDate(new Date().getDate() - 30))
                },
                is_paid: false
            },
            orderBy: { created_at: "desc" },
            select: { amount: true }
        });

        const netEarnings = await prisma.transaction.findMany({
            where: {
                kiosk_id: kioskId,
                created_at: {
                    gte: new Date(new Date().setDate(new Date().getDate() - 30))
                }
            },
            orderBy: { created_at: "desc" },
            select: { amount_net: true, amount_gross: true }
        });

        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            select: { name: true, status: true, user_id: true, id: true }
        });

        const totalGross = netEarnings.reduce(
            (sum, d) => sum + Number(d.amount_gross),
            0
        );
        const totalDue = dues.reduce((sum, d) => sum + Number(d.amount), 0);
        const totalNetEarnings = netEarnings.reduce(
            (sum, d) => sum + Number(d.amount_net),
            0
        );

        return {
            kiosk,
            summary: {
                total_gross: totalGross.toString(),
                total_dues: totalDue.toString(),
                net_earnings: totalNetEarnings.toString(),
                workers
            }
        };
    } catch (err) {
        logger.error(`Error getting kiosk details: ${err}`);
        errorHandler(
            new AppError(
                "Error getting kiosk details",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return null;
    }
}

export async function getKioskReports(
    kioskId: string,
    ownerId: string,
    month: number,
    year: number,
    req: Request,
    res: Response
) {
    try {
        // 1. Authorization Check
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId }
        });

        if (!kiosk) {
            errorHandler(new NotFoundError("Kiosk not found"), req, res);
            return null;
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return null;
        }

        // 2. Define Time Range (Current Month)
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 3. Get Total Dues for the Month
        const duesAgg = await prisma.kioskDue.aggregate({
            where: {
                kiosk_id: kioskId,
                created_at: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                is_paid: false
            },
            _sum: {
                amount: true
            }
        });
        const totalDues = Number(duesAgg._sum.amount || 0);

        // 4. Get Total Commission for the Month
        const commissionAgg = await prisma.transaction.aggregate({
            where: {
                kiosk_id: kioskId,
                created_at: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                // Assuming commission is generated on active transactions,
                // double check if status needs to be COMPLETED.
                // Usually for reports COMPLETED is safer.
                status: "COMPLETED",
                type: "DEPOSIT"
            },
            _sum: {
                commission: true
            }
        });
        const totalCommission = Number(commissionAgg._sum.commission || 0);

        // 5. Get Workers and their Weekly Aggregation
        const workers = await prisma.workerProfile.findMany({
            where: { kiosk_id: kioskId },
            include: { user: true }
        });

        const workerReports = [];

        for (const worker of workers) {
            // Fetch all transactions for this worker in the month
            const txs = await prisma.transaction.findMany({
                where: {
                    kiosk_id: kioskId,
                    sender_id: worker.user_id, // Assuming worker is the sender
                    created_at: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    },
                    status: "COMPLETED",
                    type: "DEPOSIT"
                },
                select: {
                    id: true,
                    amount_gross: true,
                    created_at: true
                }
            });

            // Initialize buckets
            const weeks = {
                week1: 0, // Days 1-7
                week2: 0, // Days 8-14
                week3: 0, // Days 15-21
                week4: 0 // Days 22-End
            };

            for (const tx of txs) {
                const day = tx.created_at.getDate();
                const amount = Number(tx.amount_gross) || 0;

                if (day <= 7) weeks.week1 += amount;
                else if (day <= 14) weeks.week2 += amount;
                else if (day <= 21) weeks.week3 += amount;
                else weeks.week4 += amount;
            }

            workerReports.push({
                worker_id: worker.user_id,
                worker_name: worker.name,
                weekly_gross: weeks,
                total_gross:
                    weeks.week1 + weeks.week2 + weeks.week3 + weeks.week4
            });
        }

        return {
            month: startOfMonth.toLocaleString("default", {
                month: "long",
                year: "numeric"
            }),
            summary: {
                total_dues: totalDues,
                total_commission: totalCommission
            },
            worker_reports: workerReports
        };
    } catch (error) {
        logger.error(`Error generating kiosk reports: ${error}`);
        errorHandler(error, req, res);
        return null;
    }
}

/**
 * Get worker details including recent transactions.
 *
 * @param {string} workerId - The ID of the worker.
 * @param {string} ownerId - The ID of the owner (for auth check).
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} Worker details and transactions.
 */
export async function getWorkerDetails(
    workerId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
    try {
        const worker = await prisma.workerProfile.findFirst({
            where: {
                user_id: workerId,
                kiosk: { owner_id: ownerId }
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: workerId }
        });

        const transactions = await prisma.transaction.findMany({
            where: {
                sender_id: workerId,
                status: "COMPLETED",
                type: "DEPOSIT"
            },
            select: {
                amount_gross: true,
                created_at: true
            }
        });

        if (!worker) {
            errorHandler(new NotFoundError("Worker not found"), req, res);
            return null;
        }

        return {
            // ...worker,
            // user,
            id: user.id,
            name: worker.name,
            phone: user.phone,
            transactions
        };
    } catch (error) {
        logger.error(`Error getting worker details: ${error}`);
        errorHandler(error, req, res);
        return null;
    }
}

/**
 * Delete a kiosk and all associated data.
 *
 * @param {string} kioskId - The ID of the kiosk.
 * @param {string} ownerId - The ID of the owner.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<boolean>} True if deleted successfully.
 */
export async function deleteKiosk(
    kioskId: string,
    ownerId: string,
    req: Request,
    res: Response
) {
    try {
        const kiosk = await prisma.kiosk.findUnique({
            where: { id: kioskId }
        });

        if (!kiosk) {
            errorHandler(new NotFoundError("Kiosk not found"), req, res);
            return null;
        }

        if (kiosk.owner_id !== ownerId) {
            errorHandler(
                new AuthorizationError("You are not the owner of this kiosk"),
                req,
                res
            );
            return null;
        }

        // Use a transaction to ensure all related records are deleted or none are
        await prisma.$transaction(async (tx) => {
            // 1. Delete Transactions associated with this kiosk
            await tx.transaction.deleteMany({
                where: { kiosk_id: kioskId }
            });

            // 2. Delete WorkerProfiles associated with this kiosk
            await tx.workerProfile.deleteMany({
                where: { kiosk_id: kioskId }
            });

            // 3. Delete KioskDue records associated with this kiosk
            await tx.kioskDue.deleteMany({
                where: { kiosk_id: kioskId }
            });

            // 4. Finally, delete the Kiosk
            await tx.kiosk.delete({
                where: { id: kioskId }
            });
        });

        logger.info(
            `Kiosk ${kioskId} and all related records deleted by owner ${ownerId}`
        );

        // Notify owner: Kiosk deleted
        await notificationService.notifyOwnerKioskDeleted(ownerId, kiosk.name);

        return true;
    } catch (error) {
        logger.error(`Error deleting kiosk: ${error}`);
        errorHandler(error, req, res);
        return null;
    }
}

/**
 * Generate monthly report for a worker.
 *
 * @param {string} workerId - The ID of the worker.
 * @param {number} month - The month number (1-12).
 * @param {number} year - The year.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} Monthly report data.
 */
export async function getWorkerReport(
    workerId: string,
    workerProfileId: string,
    month: number,
    year: number,
    req: Request,
    res: Response
) {
    try {
        // 2. Define Time Range (Current Month)
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 4. Get Total Commission for the Month
        const commissionAgg = await prisma.transaction.aggregate({
            where: {
                workerprofile_id: workerProfileId,
                created_at: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                status: "COMPLETED",
                type: "DEPOSIT"
            },
            _sum: {
                commission: true
            }
        });
        const totalCommission = Number(commissionAgg._sum.commission || 0);

        const worker = await prisma.user.findUnique({
            where: { id: workerId }
        });

        // Fetch all transactions for this worker in the month
        const txs = await prisma.transaction.findMany({
            where: {
                workerprofile_id: workerProfileId,
                created_at: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                status: "COMPLETED",
                type: "DEPOSIT"
            },
            select: {
                id: true,
                amount_gross: true,
                created_at: true
            }
        });

        // Initialize buckets
        const weeks = {
            week1: 0, // Days 1-7
            week2: 0, // Days 8-14
            week3: 0, // Days 15-21
            week4: 0 // Days 22-End
        };

        for (const tx of txs) {
            const day = tx.created_at.getDate();
            const amount = Number(tx.amount_gross) || 0;

            if (day <= 7) weeks.week1 += amount;
            else if (day <= 14) weeks.week2 += amount;
            else if (day <= 21) weeks.week3 += amount;
            else weeks.week4 += amount;
        }

        const workerReport = {
            worker_id: workerId,
            worker_name: worker.full_name,
            weekly_gross: weeks,
            total_gross: weeks.week1 + weeks.week2 + weeks.week3 + weeks.week4
        };

        return {
            month: startOfMonth.toLocaleString("default", {
                month: "long",
                year: "numeric"
            }),
            summary: {
                total_commission: totalCommission
            },
            worker_report: workerReport
        };
    } catch (error) {
        logger.error(`Error generating kiosk reports: ${error}`);
        errorHandler(error, req, res);
        return null;
    }
}

export async function getWorkerKiosks(
    workerId: string,
    req: Request,
    res: Response
) {
    try {
        const workerProfiles = await prisma.workerProfile.findMany({
            where: {
                user_id: workerId,
                status: "ACTIVE"
            },
            include: {
                kiosk: true
            }
        });

        return {
            kiosks: workerProfiles.map((workerProfile) => {
                return {
                    workerProfileId: workerProfile.id,
                    kiosk: {
                        name: workerProfile.kiosk.name,
                        id: workerProfile.kiosk.id
                    }
                };
            })
        };
    } catch (error) {
        logger.error(`Error generating kiosk reports: ${error}`);
        errorHandler(error, req, res);
        return null;
    }
}
