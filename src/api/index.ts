import { Router } from "express";
import authRoutes from "./auth/auth.routes";
import walletRoutes from "./wallet/wallet.routes";
import transactionRoutes from "./transactions/transaction.routes";
import kioskRoutes from "./kiosks/kiosk.routes";
import adminRoutes from "./admin/admin.routes";

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

export default router;
