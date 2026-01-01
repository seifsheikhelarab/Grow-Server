import { Request, Response } from "express";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import * as notificationService from "./notifications.service.js";

/**
 * Get owner notifications.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getOwnerNotifications = asyncHandler(
    async (req: Request, res: Response) => {
        const ownerId = req.user!.id;

        const notifications = await notificationService.getOwnerNotifications(
            ownerId,
            req,
            res
        );

        if (res.headersSent) return;

        ResponseHandler.success(res, "Notifications retrieved successfully", {
            notifications
        });
    }
);

/**
 * Get worker notifications.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerNotifications = asyncHandler(
    async (req: Request, res: Response) => {
        const workerId = req.user!.id;

        const notifications = await notificationService.getWorkerNotifications(
            workerId,
            req,
            res
        );

        if (res.headersSent) return;

        ResponseHandler.success(res, "Notifications retrieved successfully", {
            notifications
        });
    }
);

/**
 * Mark a notification as read.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const markNotificationAsRead = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { notificationId } = req.params;

        const result = await notificationService.markAsRead(
            notificationId,
            userId,
            req,
            res
        );

        if (res.headersSent) return;

        if (!result) {
            ResponseHandler.error(
                res,
                "لم يتم العثور على الإشعار",
                "NOT_FOUND",
                404
            );
            return;
        }

        ResponseHandler.success(res, "Notification marked as read", {});
    }
);

/**
 * Mark all notifications as read.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const markAllNotificationsAsRead = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.id;

        const count = await notificationService.markAllAsRead(userId, req, res);

        if (res.headersSent) return;

        ResponseHandler.success(res, "All notifications marked as read", {
            count
        });
    }
);
