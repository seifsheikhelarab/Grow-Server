import prisma from "../../prisma.js";
import logger from "../../utils/logger.js";
import { errorHandler } from "../../middlewares/error.middleware.js";
import { Request, Response } from "express";
import { NotificationType } from "@prisma/client";

// ============================================================================
// CORE NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Create a new notification.
 *
 * @param {string} userId - The ID of the user to notify.
 * @param {string} title - The title of the notification.
 * @param {string} message - The message body of the notification.
 * @param {NotificationType} type - The type of the notification.
 * @returns {Promise<object>} The created notification.
 */
export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType
) {
    try {
        const notification = await prisma.notification.create({
            data: {
                user_id: userId,
                title,
                message,
                type
            }
        });
        logger.info(`Notification created for user ${userId}: ${type}`);
        return notification;
    } catch (error) {
        logger.error(`Error creating notification: ${error}`);
        return null;
    }
}

/**
 * Get notifications for a user (past 7 days).
 *
 * @param {string} userId - The ID of the user.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[]>} List of notifications.
 */
export async function getUserNotifications(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const notifications = await prisma.notification.findMany({
            where: {
                user_id: userId,
                created_at: {
                    gte: sevenDaysAgo
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });

        logger.info(`Notifications fetched for user ${userId}`);
        return notifications;
    } catch (error) {
        errorHandler(error, req, res);
        return [];
    }
}

/**
 * Mark a notification as read.
 *
 * @param {string} notificationId - The ID of the notification.
 * @param {string} userId - The ID of the user (for ownership verification).
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object | null>} The updated notification.
 */
export async function markAsRead(
    notificationId: string,
    userId: string,
    req: Request,
    res: Response
) {
    try {
        const notification = await prisma.notification.updateMany({
            where: {
                id: notificationId,
                user_id: userId
            },
            data: {
                read: true
            }
        });

        if (notification.count === 0) {
            logger.warn(
                `Notification not found or not owned by user: ${notificationId}`
            );
            return null;
        }

        logger.info(`Notification ${notificationId} marked as read`);
        return notification;
    } catch (error) {
        errorHandler(error, req, res);
        return null;
    }
}

/**
 * Mark all notifications as read for a user.
 *
 * @param {string} userId - The ID of the user.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<number>} The count of updated notifications.
 */
export async function markAllAsRead(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        const result = await prisma.notification.updateMany({
            where: {
                user_id: userId,
                read: false
            },
            data: {
                read: true
            }
        });

        logger.info(
            `${result.count} notifications marked as read for user ${userId}`
        );
        return result.count;
    } catch (error) {
        errorHandler(error, req, res);
        return 0;
    }
}

/**
 * Delete notifications older than 7 days.
 * This should be called periodically (e.g., by a cron job).
 *
 * @returns {Promise<number>} The count of deleted notifications.
 */
export async function deleteOldNotifications() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const result = await prisma.notification.deleteMany({
            where: {
                created_at: {
                    lt: sevenDaysAgo
                }
            }
        });

        logger.info(`Deleted ${result.count} old notifications`);
        return result.count;
    } catch (error) {
        logger.error(`Error deleting old notifications: ${error}`);
        return 0;
    }
}

// ============================================================================
// OWNER NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify owner: Worker invitation sent.
 */
export async function notifyOwnerInvitationSent(
    ownerId: string,
    workerName: string,
    kioskName: string
) {
    return createNotification(
        ownerId,
        "تم ارسال دعوة",
        `تم ارسال دعوة ل ${workerName} ل "${kioskName}".`,
        "WORKER_INVITATION_SENT"
    );
}
/**
 * Notify owner: Worker accepted/declined invitation.
 */
export async function notifyOwnerInvitationResponse(
    ownerId: string,
    workerName: string,
    kioskName: string,
    accepted: boolean
) {
    const action = accepted ? "قبول" : "رفض";
    return createNotification(
        ownerId,
        `تم ${accepted ? "قبول" : "رفض"} دعوة`,
        `${workerName} ${action} دعوة ل "${kioskName}".`,
        "WORKER_INVITATION_RESPONSE"
    );
}

/**
 * Notify owner: New redemption request created.
 */
export async function notifyOwnerNewRedemption(
    ownerId: string,
    userName: string,
    amount: string
) {
    return createNotification(
        ownerId,
        "طلب سحب جديد",
        `${userName} طلب سحب ${amount} نقطة.`,
        "REDEMPTION_REQUEST_NEW"
    );
}

/**
 * Notify owner: Redemption request processed.
 */
export async function notifyOwnerRedemptionProcessed(
    ownerId: string,
    userName: string,
    approved: boolean,
    amount: string
) {
    return createNotification(
        ownerId,
        `تم ${approved ? "قبول" : "رفض"} طلب سحب`,
        `تم ${approved ? "قبول" : "رفض"} طلب سحب ${amount} نقطة ل ${userName}.`,
        "REDEMPTION_REQUEST_PROCESSED"
    );
}

/**
 * Notify owner: Worker created a redemption request.
 */
export async function notifyOwnerWorkerRedemption(
    ownerId: string,
    workerName: string,
    amount: string
) {
    return createNotification(
        ownerId,
        "طلب سحب من عامل",
        `${workerName} طلب سحب ${amount} نقطة.`,
        "WORKER_REDEMPTION_CREATED"
    );
}

/**
 * Notify owner: Due pending for more than 3 days.
 */
export async function notifyOwnerDuePending(
    ownerId: string,
    kioskName: string,
    amount: string,
    daysPending: number
) {
    return createNotification(
        ownerId,
        "مستحقات معلقة",
        `مستحقات معلقة ل "${kioskName}" لفترة ${daysPending} يومًا.`,
        "DUE_PENDING"
    );
}

/**
 * Notify owner: Due paid (partially or fully).
 */
export async function notifyOwnerDuePaid(
    ownerId: string,
    kioskName: string,
    amount: string,
    partial: boolean
) {
    const status = partial ? "جزئيا" : "بشكل كامل";
    return createNotification(
        ownerId,
        `تم سداد مستحقات ${status}`,
        `تم دفع ${amount} نقطة ل "${kioskName}" ${status}.`,
        "DUE_PAID"
    );
}

/**
 * Notify owner: Worker left kiosk.
 */
export async function notifyOwnerWorkerLeft(
    ownerId: string,
    workerName: string,
    kioskName: string
) {
    return createNotification(
        ownerId,
        "عامل غادر الكشك",
        `${workerName} غادر "${kioskName}".`,
        "WORKER_LEFT_KIOSK"
    );
}

/**
 * Notify owner: Worker suspended/banned.
 */
export async function notifyOwnerWorkerStatus(
    ownerId: string,
    workerName: string,
    status: string
) {
    return createNotification(
        ownerId,
        `Worker ${status}`,
        `${workerName} ${status.toLowerCase()}.`,
        "USER_STATUS_CHANGED"
    );
}

/**
 * Notify owner: Kiosk suspended/banned.
 */
export async function notifyOwnerKioskStatus(
    ownerId: string,
    kioskName: string,
    status: string
) {
    return createNotification(
        ownerId,
        `الكشك ${status}`,
        `${kioskName} ${status.toLowerCase()}.`,
        "KIOSK_STATUS_CHANGED"
    );
}

/**
 * Notify owner: Transaction completed by owner/worker.
 */
export async function notifyOwnerTransaction(
    ownerId: string,
    senderName: string,
    amount: string,
    receiverPhone: string
) {
    return createNotification(
        ownerId,
        "تم إتمام المعاملة",
        `${senderName} ارسل ${amount} نقطة إلى ${receiverPhone}.`,
        "TRANSACTION_COMPLETED"
    );
}

/**
 * Notify owner: Kiosk added successfully.
 */
export async function notifyOwnerKioskCreated(
    ownerId: string,
    kioskName: string
) {
    return createNotification(
        ownerId,
        "تم إضافة الكشك",
        `"${kioskName}" تم إضافة الكشك بنجاح.`,
        "KIOSK_CREATED"
    );
}

/**
 * Notify owner: Kiosk deleted successfully.
 */
export async function notifyOwnerKioskDeleted(
    ownerId: string,
    kioskName: string
) {
    return createNotification(
        ownerId,
        "تم حذف الكشك",
        `"${kioskName}" تم حذف الكشك بنجاح.`,
        "KIOSK_DELETED"
    );
}

// ============================================================================
// WORKER NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify worker: New invitation to kiosk.
 */
export async function notifyWorkerNewInvitation(
    workerId: string,
    kioskName: string,
    ownerName: string
) {
    return createNotification(
        workerId,
        "تم دعوة جديدة",
        `${ownerName} دعاك ل "${kioskName}".`,
        "WORKER_INVITATION_SENT"
    );
}

/**
 * Notify worker: New redemption request (their own).
 */
export async function notifyWorkerRedemptionCreated(
    workerId: string,
    amount: string
) {
    return createNotification(
        workerId,
        "تم طلب سحب جديد",
        `طلب سحب ${amount} نقطة تم.`,
        "REDEMPTION_REQUEST_NEW"
    );
}

/**
 * Notify worker: Redemption request accepted/declined.
 */
export async function notifyWorkerRedemptionProcessed(
    workerId: string,
    approved: boolean,
    amount: string
) {
    const status = approved ? "تم قبوله" : "تم رفضه";
    return createNotification(
        workerId,
        `${approved ? "تم قبول" : "تم رفض"} طلب سحب`,
        `طلب سحب ${amount} نقطة ${status}.`,
        "REDEMPTION_REQUEST_PROCESSED"
    );
}

/**
 * Notify worker: Transaction completed successfully.
 */
export async function notifyWorkerTransaction(
    workerId: string,
    amount: string,
    receiverPhone: string
) {
    return createNotification(
        workerId,
        "تم إتمام المعاملة",
        `تم إتمام المعاملة ${amount} نقطة إلى ${receiverPhone}.`,
        "TRANSACTION_COMPLETED"
    );
}

// ============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Get notifications for an owner.
 *
 * @param {string} ownerId - The ID of the owner.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[]>} List of notifications.
 */
export async function getOwnerNotifications(
    ownerId: string,
    req: Request,
    res: Response
) {
    return getUserNotifications(ownerId, req, res);
}

/**
 * Get notifications for a worker.
 *
 * @param {string} workerId - The ID of the worker.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<object[]>} List of notifications.
 */
export async function getWorkerNotifications(
    workerId: string,
    req: Request,
    res: Response
) {
    return getUserNotifications(workerId, req, res);
}
