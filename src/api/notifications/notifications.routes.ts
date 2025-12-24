
import { Router } from "express";
import * as notificationController from "./notifications.controller.js";
import { authMiddleware, roleGuard } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/owner", roleGuard("OWNER"), notificationController.getOwnerNotifications);
router.get("/worker", roleGuard("WORKER"), notificationController.getWorkerNotifications);

export default router;