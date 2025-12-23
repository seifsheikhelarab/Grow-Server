import { Router } from "express";
import authRoutes from "./auth/auth.routes.js";
import walletRoutes from "./wallet/wallet.routes.js";
import transactionRoutes from "./transactions/transaction.routes.js";
import kioskRoutes from "./kiosks/kiosk.routes.js";
import adminRoutes from "./admin/admin.routes.js";
import dashboardRoutes from "./dashboard/dashboard.routes.js";
import profileRoutes from "./profile/profile.routes.js";
import goalsRoutes from "./goals/goals.routes.js";

const router = Router();

/**
 * API Routes
 * Mounts all feature-specific routes.
 */
router.use("/auth", authRoutes);
router.use("/wallet", walletRoutes);
router.use("/transactions", transactionRoutes);
router.use("/kiosks", kioskRoutes);
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/goals", goalsRoutes);
router.use("/profile", profileRoutes);

export default router;
