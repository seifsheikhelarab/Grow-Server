import prisma from "../../prisma";
import bcrypt from "bcrypt";
import { AdminRole } from "@prisma/client";
import {
    NotFoundError,
    BusinessLogicError,
    ErrorCode
} from "../../utils/response";
import logger from "../../utils/logger";
import { errorHandler } from "../../middlewares/error.middleware";
import { Request, Response } from "express";

/**
 * Get admin dashboard stats.
 *
 * @param {"1d" | "7d" | "30d"} filter - Time period filter (default: "7d").
 * @returns {Promise<object>} Dashboard statistics.
 */
export async function getDashboardStats(filter: "1d" | "7d" | "30d" = "7d") {
    try {
        const startDate = new Date();

        if (filter === "1d") {
            startDate.setHours(-24, 0, 0, 0);
        } else if (filter === "7d") {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }

        // Total users
        const totalUsers = await prisma.user.count();

        // Users by role
        const usersByRole = await prisma.user.groupBy({
            by: ["role"],
            _count: true
        });

        // Transactions in period
        const transactions = await prisma.transaction.aggregate({
            where: { created_at: { gte: startDate } },
            _count: true,
            _sum: {
                amount_gross: true,
                amount_net: true,
                commission: true
            }
        });

        // Total points in circulation (in wallets + shadow wallets)
        const walletBalance = await prisma.wallet.aggregate({
            _sum: { balance: true }
        });

        const shadowBalance = await prisma.shadowWallet.aggregate({
            _sum: { balance: true }
        });

        // Unpaid dues
        const unpaidDues = await prisma.kioskDue.aggregate({
            where: { is_paid: false },
            _count: true,
            _sum: { amount: true }
        });

        // Pending redemptions
        const pendingRedemptions = await prisma.redemptionRequest.count({
            where: { status: "PENDING" }
        });

        return {
            period: filter,
            summary: {
                total_users: totalUsers,
                total_wallets_balance: walletBalance._sum.balance
                    ? walletBalance._sum.balance.toNumber
                        ? walletBalance._sum.balance.toNumber()
                        : Number(walletBalance._sum.balance)
                    : 0,
                total_shadow_balance: shadowBalance._sum.balance
                    ? shadowBalance._sum.balance.toNumber
                        ? shadowBalance._sum.balance.toNumber()
                        : Number(shadowBalance._sum.balance)
                    : 0,
                total_circulation:
                    Number(walletBalance._sum.balance || 0) +
                    Number(shadowBalance._sum.balance || 0)
            },
            transactions: {
                count: transactions._count,
                total_gross: transactions._sum.amount_gross
                    ? transactions._sum.amount_gross.toNumber
                        ? transactions._sum.amount_gross.toNumber()
                        : Number(transactions._sum.amount_gross)
                    : 0,
                total_net: transactions._sum.amount_net
                    ? transactions._sum.amount_net.toNumber
                        ? transactions._sum.amount_net.toNumber()
                        : Number(transactions._sum.amount_net)
                    : 0,
                total_commission: transactions._sum.commission
                    ? transactions._sum.commission.toNumber
                        ? transactions._sum.commission.toNumber()
                        : Number(transactions._sum.commission)
                    : 0
            },
            users_by_role: usersByRole.map((r) => ({
                role: r.role,
                count: r._count
            })),
            pending_items: {
                redemptions: pendingRedemptions
            },
            dues: {
                unpaid_count: unpaidDues._count,
                unpaid_amount: unpaidDues._sum.amount
                    ? unpaidDues._sum.amount.toNumber
                        ? unpaidDues._sum.amount.toNumber()
                        : Number(unpaidDues._sum.amount)
                    : 0
            }
        };
    } catch (err) {
        logger.error(`Error getting dashboard stats: ${err}`);
        throw err;
    }
}

/**
 * Get pending redemptions.
 *
 * @returns {Promise<object[]>} List of pending redemptions.
 */
export async function getPendingRedemptions() {
    try {
        const redemptions = await prisma.redemptionRequest.findMany({
            where: { status: "PENDING" },
            include: {
                user: {
                    select: { phone: true, role: true }
                }
            },
            orderBy: { created_at: "asc" }
        });

        return redemptions.map((r) => ({
            id: r.id,
            user_phone: r.user.phone,
            user_role: r.user.role,
            amount: r.amount.toString(),
            method: r.method,
            details: r.details,
            created_at: r.created_at
        }));
    } catch (err) {
        logger.error(`Error getting pending redemptions: ${err}`);
        throw err;
    }
}

/**
 * Process redemption request.
 *
 * @param {string} redemptionId - The ID of the redemption request.
 * @param {"APPROVE" | "REJECT"} action - The action to perform.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {string} [note] - Optional note from admin.
 * @returns {Promise<object>} The updated redemption request.
 */
export async function processRedemption(
    redemptionId: string,
    action: "APPROVE" | "REJECT",
    req: Request,
    res: Response,
    note?: string
) {
    try {
        const redemption = await prisma.redemptionRequest.findUnique({
            where: { id: redemptionId }
        });

        if (!redemption) {
            errorHandler(
                new NotFoundError("Redemption request not found"),
                req,
                res
            );
        }

        if (redemption.status !== "PENDING") {
            errorHandler(
                new BusinessLogicError(
                    `Redemption is already ${redemption.status.toLowerCase()}`,
                    ErrorCode.RESOURCE_CONFLICT
                ),
                req,
                res
            );
        }

        const status = action === "APPROVE" ? "COMPLETED" : "REJECTED";

        const updated = await prisma.$transaction(async (tx) => {
            // If rejected, refund points to user
            if (action === "REJECT") {
                const amount = redemption.amount.toNumber
                    ? redemption.amount.toNumber()
                    : Number(redemption.amount);
                await tx.wallet.update({
                    where: { user_id: redemption.user_id },
                    data: { balance: { increment: amount } }
                });
            }

            return await tx.redemptionRequest.update({
                where: { id: redemptionId },
                data: { status, admin_note: note }
            });
        });

        logger.info(`Redemption ${action.toLowerCase()}: ${redemptionId}`);
        return updated;
    } catch (err) {
        logger.error(`Error processing redemption: ${err}`);
        throw err;
    }
}

/**
 * Collect due.
 *
 * @param {string} dueId - The ID of the due to collect.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object>} The updated due.
 */
export async function collectDue(dueId: string, req: Request, res: Response) {
    try {
        const due = await prisma.kioskDue.findUnique({
            where: { id: dueId }
        });

        if (!due) {
            errorHandler(new NotFoundError("Due not found"), req, res);
        }

        if (due.is_paid) {
            errorHandler(
                new BusinessLogicError(
                    "Due is already paid",
                    ErrorCode.RESOURCE_CONFLICT
                ),
                req,
                res
            );
        }

        const updated = await prisma.kioskDue.update({
            where: { id: dueId },
            data: { is_paid: true }
        });

        logger.info(`Due collected: ${dueId}`);
        return updated;
    } catch (err) {
        logger.error(`Error collecting due: ${err}`);
        throw err;
    }
}
/**
 * Log an admin action.
 */
export async function logAdminAction(
    adminId: string,
    action: string,
    targetId?: string,
    details?: unknown
) {
    try {
        await prisma.auditLog.create({
            data: {
                admin_id: adminId,
                action,
                target_id: targetId,
                details: details ? JSON.stringify(details) : undefined,
                ip_address: "0.0.0.0" // Placeholder, should get from request context if possible
            }
        });
    } catch (err) {
        logger.error(`Error creating audit log: ${err}`);
        // Don't throw, just log error to avoid breaking main flow
    }
}

/**
 * Get system settings.
 */
export async function getSystemSettings() {
    try {
        const settings = await prisma.systemSetting.findMany();
        // Convert array to object for easier consumption
        const settingsMap: Record<string, boolean | string | number> = {};
        settings.forEach((s) => {
            try {
                settingsMap[s.key] = JSON.parse(s.value);
            } catch {
                settingsMap[s.key] = s.value;
            }
        });
        return settingsMap;
    } catch (err) {
        logger.error(`Error getting settings: ${err}`);
        throw err;
    }
}

/**
 * Update system setting.
 */
export async function updateSystemSetting(
    key: string,
    value: boolean | string | number,
    adminId: string,
    description?: string
) {
    try {
        const strValue =
            typeof value === "string" ? value : JSON.stringify(value);

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value: strValue, description },
            create: { key, value: strValue, description }
        });

        await logAdminAction(adminId, "UPDATE_SETTING", key, {
            value,
            description
        });

        return setting;
    } catch (err) {
        logger.error(`Error updating setting ${key}: ${err}`);
        throw err;
    }
}

/**
 * Create a new admin user.
 */
export async function createAdminUser(
    phone: string,
    fullName: string,
    password: string,
    adminRole: AdminRole,
    creatorId: string,
    req: Request,
    res: Response
): Promise<object | void> {
    try {
        const existingUser = await prisma.user.findUnique({ where: { phone } });
        if (existingUser) {
            errorHandler(
                new BusinessLogicError(
                    "User with this phone already exists",
                    ErrorCode.RESOURCE_CONFLICT
                ),
                req,
                res
            );
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newAdmin = await prisma.user.create({
            data: {
                phone,
                full_name: fullName,
                password_hash: passwordHash,
                role: "ADMIN",
                admin_role: adminRole,
                is_active: true,
                is_verified: true
            }
        });

        await logAdminAction(creatorId, "CREATE_ADMIN", newAdmin.id, {
            role: adminRole
        });

        return {
            id: newAdmin.id,
            phone: newAdmin.phone,
            role: newAdmin.role,
            admin_role: newAdmin.admin_role
        };
    } catch (err) {
        logger.error(`Error creating admin: ${err}`);
        throw err;
    }
}

/**
 * List all admins.
 */
export async function getAllAdmins() {
    try {
        return await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: {
                id: true,
                full_name: true,
                phone: true,
                admin_role: true,
                is_active: true,
                created_at: true
            }
        });
    } catch (err) {
        logger.error(`Error getting admins: ${err}`);
        throw err;
    }
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

async function updateUserStatusHelper(id: string, status: string, adminId: string, note?: string) {
    let data: any = {};
    if (status === "ACTIVE") {
        data = { is_active: true, is_verified: true };
    } else if (status === "SUSPENDED") {
        data = { is_active: false };
    } else if (status === "PENDING") {
        data = { is_verified: false, is_active: true };
    } else if (status === "REJECTED") {
        data = { is_verified: false, is_active: false };
    }

    const updated = await prisma.user.update({
        where: { id },
        data
    });
    await logAdminAction(adminId, "UPDATE_USER_STATUS", id, { status, note });
    return updated;
}

// ============================================================================
// OWNER SERVICES
// ============================================================================

/**
 * Get owners with filters.
 */
export async function getOwners(filters: any) {
    try {
        const { search, status, page = 1, limit = 10 } = filters;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { role: "OWNER" };

        if (search) {
            where.OR = [
                { full_name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } }
            ];
        }

        if (status) {
            if (status === "ACTIVE") {
                where.is_active = true;
                where.is_verified = true;
            }
            else if (status === "SUSPENDED") {
                where.is_active = false;
            }
            else if (status === "PENDING") {
                where.is_verified = false;
                where.is_active = true;
            }
        }

        const [owners, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { created_at: "desc" },
                select: {
                    id: true,
                    full_name: true,
                    phone: true,
                    is_active: true,
                    is_verified: true,
                    created_at: true,
                    wallet: { select: { balance: true } }
                }
            }),
            prisma.user.count({ where })
        ]);

        return { owners, total, page: Number(page), limit: Number(limit) };
    } catch (err) {
        logger.error(`Error getting owners: ${err}`);
        throw err;
    }
}

/**
 * Get owner details.
 */
export async function getOwnerDetails(id: string) {
    try {
        const owner = await prisma.user.findUnique({
            where: { id },
            include: {
                wallet: true,
                owned_kiosks: {
                    include: {
                        // Check schema again, Kiosk -> workers (WorkerProfile[]) -> user
                        workers: { include: { user: true } },
                        _count: { select: { workers: true } }
                    }
                }
            }
        });
        if (!owner) throw new Error("Owner not found");
        return owner;
    } catch (err) {
        logger.error(`Error getting owner details: ${err}`);
        throw err;
    }
}

/**
 * Update owner status.
 */
export async function updateOwnerStatus(id: string, status: any, adminId: string, note?: string) {
    return updateUserStatusHelper(id, status, adminId, note);
}

/**
 * Update owner details.
 */
export async function updateOwner(id: string, data: any, adminId: string) {
    try {
        const updated = await prisma.user.update({
            where: { id },
            data
        });
        await logAdminAction(adminId, "UPDATE_OWNER", id, data);
        return updated;
    } catch (err) {
        logger.error(`Error updating owner: ${err}`);
        throw err;
    }
}

/**
 * Adjust owner balance.
 */
export async function adjustBalance(id: string, amount: number, reason: string, adminId: string) {
    try {
        const updated = await prisma.wallet.update({
            where: { user_id: id },
            data: { balance: { increment: amount } }
        });
        await logAdminAction(adminId, "ADJUST_BALANCE", id, { amount, reason });
        return updated;
    } catch (err) {
        logger.error(`Error adjusting balance: ${err}`);
        throw err;
    }
}

// ============================================================================
// KIOSK SERVICES
// ============================================================================

/**
 * Get kiosks with filters.
 */
export async function getKiosks(filters: any) {
    try {
        const { search, status, ownerId, page = 1, limit = 10 } = filters;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        if (status) {
            where.is_active = status === "active";
        }

        if (ownerId) {
            where.owner_id = ownerId;
        }

        const [kiosks, total] = await Promise.all([
            prisma.kiosk.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    owner: { select: { full_name: true, phone: true } },
                    _count: { select: { workers: true } }
                }
            }),
            prisma.kiosk.count({ where })
        ]);

        return { kiosks, total, page: Number(page), limit: Number(limit) };
    } catch (err) {
        logger.error(`Error getting kiosks: ${err}`);
        throw err;
    }
}

/**
 * Get kiosk details.
 */
export async function getKioskDetails(id: string) {
    try {
        const kiosk = await prisma.kiosk.findUnique({
            where: { id },
            include: {
                owner: { select: { full_name: true, phone: true } },
                workers: { select: { id: true, user: { select: { full_name: true, phone: true } } } },
                dues: { orderBy: { created_at: 'desc' }, take: 5 }
            }
        });
        if (!kiosk) throw new Error("Kiosk not found");
        return kiosk;
    } catch (err) {
        logger.error(`Error getting kiosk details: ${err}`);
        throw err;
    }
}

/**
 * Create kiosk manually.
 */
export async function createKiosk(data: any, adminId: string, req: Request, res: Response) {
    try {
        const owner = await prisma.user.findUnique({ where: { phone: data.ownerPhone } });
        if (!owner || owner.role !== "OWNER") {
            errorHandler(new BusinessLogicError("Owner not found or invalid role", ErrorCode.RESOURCE_NOT_FOUND), req, res);
            return undefined;
        }

        const kiosk = await prisma.kiosk.create({
            data: {
                name: data.name,
                location: data.location,
                latitude: data.latitude,
                longitude: data.longitude,
                owner_id: owner.id,
                kiosk_type: "STANDARD" // Default type
            }
        });
        await logAdminAction(adminId, "CREATE_KIOSK", kiosk.id, data);
        return kiosk;
    } catch (err) {
        logger.error(`Error creating kiosk: ${err}`);
        throw err;
    }
}

/**
 * Update kiosk status.
 */
export async function updateKioskStatus(id: string, is_active: boolean, reason: string, adminId: string) {
    try {
        const updated = await prisma.kiosk.update({
            where: { id },
            data: { is_active }
        });
        await logAdminAction(adminId, "UPDATE_KIOSK_STATUS", id, { is_active, reason });
        return updated;
    } catch (err) {
        logger.error(`Error updating kiosk status: ${err}`);
        throw err;
    }

}

// ============================================================================
// WORKER SERVICES
// ============================================================================

export async function getWorkers(filters: any) {
    try {
        const { search, status, kioskId, page = 1, limit = 10 } = filters;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { role: "WORKER" };

        if (search) {
            where.OR = [
                { full_name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } }
            ];
        }
        if (status) {
            where.is_active = status === "active";
        }
        if (kioskId) {
            where.worker_profile = { kiosk_id: kioskId };
        }

        const [workers, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    worker_profile: { include: { kiosk: { select: { name: true } } } },
                    wallet: { select: { balance: true } }
                }
            }),
            prisma.user.count({ where })
        ]);
        return { workers, total, page: Number(page), limit: Number(limit) };
    } catch (err) {
        logger.error(`Error getting workers: ${err}`);
        throw err;
    }
}

export async function getWorkerDetails(id: string) {
    try {
        const worker = await prisma.user.findUnique({
            where: { id },
            include: {
                wallet: true,
                worker_profile: { include: { kiosk: true } },
                goals: true
            }
        });
        if (!worker) throw new Error("Worker not found");
        return worker;
    } catch (err) {
        logger.error(`Error getting worker details: ${err}`);
        throw err;
    }
}

export async function updateWorkerStatus(id: string, status: any, adminId: string, note?: string) {
    return updateUserStatusHelper(id, status, adminId, note);
}

export async function reassignWorker(id: string, kioskId: string, adminId: string) {
    try {
        const worker = await prisma.user.findUnique({ where: { id }, include: { worker_profile: true } });
        if (!worker || !worker.worker_profile) throw new Error("Worker profile not found");

        const updated = await prisma.workerProfile.update({
            where: { id: worker.worker_profile.id },
            data: { kiosk_id: kioskId }
        });
        await logAdminAction(adminId, "REASSIGN_WORKER", id, { from: worker.worker_profile.kiosk_id, to: kioskId });
        return updated;
    } catch (err) {
        logger.error(`Error reassigning worker: ${err}`);
        throw err;
    }
}

// ============================================================================
// CUSTOMER SERVICES
// ============================================================================

export async function getCustomers(filters: any) {
    try {
        const { search, status, page = 1, limit = 10 } = filters;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { role: "CUSTOMER" };

        if (search) {
            where.OR = [
                { full_name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } }
            ];
        }
        if (status) {
            where.is_active = status === "active";
        }

        const [customers, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    wallet: { select: { balance: true } },
                    _count: { select: { redemptions: true } }
                }
            }),
            prisma.user.count({ where })
        ]);
        return { customers, total, page: Number(page), limit: Number(limit) };
    } catch (err) {
        logger.error(`Error getting customers: ${err}`);
        throw err;
    }
}

export async function getCustomerDetails(id: string) {
    try {
        const customer = await prisma.user.findUnique({
            where: { id },
            include: {
                wallet: true,
                redemptions: { orderBy: { created_at: "desc" }, take: 10 },
                goals: true
            }
        });
        if (!customer) throw new Error("Customer not found");
        return customer;
    } catch (err) {
        logger.error(`Error getting customer details: ${err}`);
        throw err;
    }
}

export async function updateCustomerStatus(id: string, status: any, adminId: string, note?: string) {
    return updateUserStatusHelper(id, status, adminId, note);
}
