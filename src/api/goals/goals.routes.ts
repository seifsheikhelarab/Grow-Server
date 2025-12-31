import { Router } from "express";
import { setGoal, getGoal, getWorkerStatus, removeGoal } from "./goals.controller.js";
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

// Get Goal: Owner
router.get("/:kioskId", authMiddleware, roleGuard("OWNER"), getGoal);

// Remove Goal: Owner
router.delete("/:kioskId", authMiddleware, roleGuard("OWNER"), removeGoal);

// Get Worker Goals: Worker
router.get("/", authMiddleware, roleGuard("WORKER"), getWorkerStatus);

export default router;
