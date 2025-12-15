import { Router } from "express";
import * as transactionController from "./transaction.controller.js";
import { authMiddleware, roleGuard } from "../../middlewares/auth.middleware.js";
import { sendPointsSchema } from "../../schemas/validation.schema.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { transactionLimiter } from "../../middlewares/ratelimit.middleware.js";

const router = Router();

// All transaction routes require authentication and worker/owner role
router.use(authMiddleware);
router.use(roleGuard("WORKER", "OWNER"));

/**
 * POST /api/transactions
 * Send points to customer.
 */
router.post(
    "/",
    transactionLimiter,
    validateRequest(sendPointsSchema),
    transactionController.sendPoints
);

/**
 * GET /api/transactions/
 * Get transaction history.
 */
router.get("/", transactionController.getHistory);

/**
 * GET /api/transactions/daily-stats
 * Get daily transaction statistics.
 */
router.get("/stats", transactionController.getDailyStats);

export default router;
