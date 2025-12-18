import { Router } from "express";
import * as walletController from "./wallet.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js";
import {
    redeemSchema,
    createGoalSchema
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

/**
 * POST /api/wallet/redeem
 * Create redemption request.
 */
router.post("/redeem", validateRequest(redeemSchema), walletController.redeem);

/**
 * POST /api/wallet/goals
 * Create goal.
 */
/**
 * GET /api/wallet/goals
 * Get user's goals.
 */
router
    .route("/goals")
    .post(
        roleGuard("CUSTOMER"),
        validateRequest(createGoalSchema),
        walletController.createGoal
    )
    .get(roleGuard("CUSTOMER"), walletController.getGoals);

/**
 * PUT /api/wallet/goals/:id
 * Edit user's goal.
 */
router
    .route("/goals/:id")
    .put(
        roleGuard("CUSTOMER"),
        validateRequest(createGoalSchema),
        walletController.editGoal
    );

export default router;
