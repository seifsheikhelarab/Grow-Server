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
        "Invitation Sent",
        `Invitation sent to ${workerName} for kiosk "${kioskName}".`,
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
    const action = accepted ? "accepted" : "declined";
    return createNotification(
        ownerId,
        `Invitation ${accepted ? "Accepted" : "Declined"}`,
        `${workerName} has ${action} the invitation to join "${kioskName}".`,
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
        "New Redemption Request",
        `${userName} has requested a redemption of ${amount} points.`,
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
    const status = approved ? "approved" : "declined";
    return createNotification(
        ownerId,
        `Redemption ${approved ? "Approved" : "Declined"}`,
        `Redemption request of ${amount} points for ${userName} has been ${status}.`,
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
        "Worker Redemption Request",
        `Your worker ${workerName} has requested a redemption of ${amount} points.`,
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
        "Due Payment Pending",
        `Due of ${amount} points for kiosk "${kioskName}" has been pending for ${daysPending} days.`,
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
    const status = partial ? "partially paid" : "fully paid";
    return createNotification(
        ownerId,
        `Due ${partial ? "Partially" : "Fully"} Paid`,
        `Due of ${amount} points for kiosk "${kioskName}" has been ${status}.`,
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
        "Worker Left Kiosk",
        `${workerName} has left kiosk "${kioskName}".`,
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
        `Your worker ${workerName} has been ${status.toLowerCase()}.`,
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
        `Kiosk ${status}`,
        `Your kiosk "${kioskName}" has been ${status.toLowerCase()}.`,
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
        "Transaction Completed",
        `${senderName} sent ${amount} points to ${receiverPhone}.`,
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
        "Kiosk Created",
        `Kiosk "${kioskName}" has been added successfully.`,
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
        "Kiosk Deleted",
        `Kiosk "${kioskName}" has been deleted.`,
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
        "New Kiosk Invitation",
        `${ownerName} has invited you to join kiosk "${kioskName}".`,
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
        "Redemption Request Submitted",
        `Your redemption request for ${amount} points has been submitted.`,
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
    const status = approved ? "approved" : "declined";
    return createNotification(
        workerId,
        `Redemption ${approved ? "Approved" : "Declined"}`,
        `Your redemption request for ${amount} points has been ${status}.`,
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
        "Transaction Completed",
        `You sent ${amount} points to ${receiverPhone}.`,
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
