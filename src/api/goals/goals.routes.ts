import { Router } from "express";
import { setGoal, getGoal } from "./goals.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js"; // Adjust path
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { setGoalSchema } from "../../schemas/validation.schema.js";

const router = Router();

// Set Goal: Only Owner
router.post(
    "/",
    authMiddleware,
    roleGuard("OWNER"),
    validateRequest(setGoalSchema),
    setGoal
);

// Get Goal: Owner or Worker
router.get("/:workerId", authMiddleware, roleGuard("OWNER", "WORKER"), getGoal);

export default router;
