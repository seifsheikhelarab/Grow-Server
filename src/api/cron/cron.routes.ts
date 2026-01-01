import { Router, Request, Response } from "express";
import { checkDailyGoals } from "../goals/goals.service.js";
import {
    deleteOldNotifications,
    notifyOwnerDuePending
} from "../notifications/notifications.service.js";
import prisma from "../../prisma.js";
import logger from "../../utils/logger.js";
import { ResponseHandler } from "../../utils/response.js";

const router = Router();

// Secret to authorize cron requests (should match CRON_SECRET env var)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Middleware to verify cron request authorization.
 * Vercel sends an Authorization header with the CRON_SECRET.
 */
function verifyCronAuth(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers.authorization;

    // In development, skip auth check or use a simpler check
    if (process.env.NODE_ENV === "development") {
        return next();
    }

    // Vercel sends: Authorization: Bearer <CRON_SECRET>
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
        return ResponseHandler.error(res, "Unauthorized", "CRON_UNAUTHORIZED", 401);
    }

    next();
}

/**
 * POST /api/v1/cron/daily-goals
 * Triggered by Vercel Cron at 23:59 daily.
 * Checks and settles recurring goals.
 */
router.post("/daily-goals", verifyCronAuth, async (req: Request, res: Response) => {
    logger.info("[Cron] Running Daily Goals Check...");
    try {
        await checkDailyGoals();
        logger.info("[Cron] Daily Goals Check completed successfully");
        return ResponseHandler.success(res, "Daily goals check completed");
    } catch (err) {
        logger.error(`[Cron] Error in Daily Goals Check: ${err}`);
        return ResponseHandler.error(res, "Daily goals check failed", "CRON_ERROR", 500);
    }
});

/**
 * POST /api/v1/cron/notification-cleanup
 * Triggered by Vercel Cron at 00:05 daily.
 * Deletes old notifications and checks for overdue dues.
 */
router.post("/notification-cleanup", verifyCronAuth, async (req: Request, res: Response) => {
    logger.info("[Cron] Running Notification Cleanup...");
    try {
        // Delete old notifications
        const deletedCount = await deleteOldNotifications();
        logger.info(`[Cron] Deleted ${deletedCount} old notifications`);

        // Check for dues pending more than 3 days
        logger.info("[Cron] Checking for overdue dues...");
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const overdueDues = await prisma.kioskDue.findMany({
            where: {
                is_paid: false,
                created_at: {
                    lt: threeDaysAgo
                }
            },
            include: {
                kiosk: {
                    select: {
                        id: true,
                        name: true,
                        owner_id: true
                    }
                }
            }
        });

        for (const due of overdueDues) {
            const daysPending = Math.floor(
                (Date.now() - due.created_at.getTime()) / (1000 * 60 * 60 * 24)
            );

            await notifyOwnerDuePending(
                due.kiosk.owner_id,
                due.kiosk.name,
                due.amount.toString(),
                daysPending
            );
        }

        logger.info(`[Cron] Notified owners about ${overdueDues.length} overdue dues`);

        return ResponseHandler.success(res, "Notification cleanup completed", {
            deletedNotifications: deletedCount,
            overdueDuesNotified: overdueDues.length
        });
    } catch (err) {
        logger.error(`[Cron] Error in Notification Cleanup: ${err}`);
        return ResponseHandler.error(res, "Notification cleanup failed", "CRON_ERROR", 500);
    }
});

export default router;
