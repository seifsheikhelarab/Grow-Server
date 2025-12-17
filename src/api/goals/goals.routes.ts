import { Router } from "express";
import { setGoal, getGoal } from "./goals.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js"; // Adjust path

const router = Router();

// Set Goal: Only Owner
router.post("/set", authMiddleware, roleGuard("OWNER"), setGoal);

// Get Goal: Owner or Worker
router.get("/:workerId", authMiddleware, getGoal);

export default router;
