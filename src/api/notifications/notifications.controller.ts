import { Request, Response } from "express";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import * as notificationService from "./notifications.service.js";

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
