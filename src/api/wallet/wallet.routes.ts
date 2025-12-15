import { Router } from "express";
import * as walletController from "./wallet.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    redeemSchema,
    createGoalSchema,
    updateGoalSchema
} from "../../schemas/validation.schema.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/wallet/balance
 * Get wallet balance.
 */
router.get("/balance", walletController.getBalance);

// /**
//  * GET /api/wallet/details
//  * Get wallet details.
//  */
// router.get("/details", walletController.getWalletDetails);

/**
 * POST /api/wallet/redeem
 * Create redemption request.
 */
router.post("/redeem", validateRequest(redeemSchema), walletController.redeem);

/**
 * POST /api/wallet/goals
 * Create goal.
 */
router.post(
    "/goals",
    validateRequest(createGoalSchema),
    walletController.createGoal
);

/**
 * GET /api/wallet/goals
 * Get user's goals.
 */
router.get("/goals", walletController.getGoals);

/**
 * PUT /api/wallet/goals/:id
 * Update goal progress.
 */
router.put(
    "/goals/:id",
    validateRequest(updateGoalSchema),
    walletController.updateGoalProgress
);

export default router;
