import { Router } from "express";
import * as notificationController from "./notifications.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

// Owner routes
router.get(
    "/owner",
    roleGuard("OWNER"),
    notificationController.getOwnerNotifications
);

// Worker routes
router.get(
    "/worker",
    roleGuard("WORKER"),
    notificationController.getWorkerNotifications
);

// Common routes (for both owners and workers)
router.patch(
    "/:notificationId/read",
    notificationController.markNotificationAsRead
);

router.post("/read-all", notificationController.markAllNotificationsAsRead);

export default router;
