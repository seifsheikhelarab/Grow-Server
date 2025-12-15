import { Router } from "express";
import * as dashboardController from "./dashboard.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * GET /dashboard/owner
 * Get owner dashboard data.
 * Protected: OWNER only.
 */
// GET /dashboard/owner
router.get(
    "/owner",
    authMiddleware,
    roleGuard("OWNER"),
    dashboardController.getOwnerDashboard
);

/**
 * GET /dashboard/worker
 * Get worker dashboard data.
 * Protected: WORKER only.
 */
router.get(
    "/worker",
    authMiddleware,
    roleGuard("WORKER"),
    dashboardController.getWorkerDashboard
);

export default router;
