import cron from "node-cron";
import prisma from "../prisma.js";
import logger from "../utils/logger.js";
import {
    deleteOldNotifications,
    notifyOwnerDuePending
} from "../api/notifications/notifications.service.js";

/**
 * Initialize the notification cleanup cron job.
 * Runs at 00:05 every day to delete notifications older than 7 days
 * and check for dues pending more than 3 days.
 */
export function initNotificationCleanupJob() {
    // Run at 00:05 every day (5 minutes after midnight)
    cron.schedule("5 0 * * *", async () => {
        logger.info("[Job] Running Notification Cleanup...");
        try {
            const deletedCount = await deleteOldNotifications();
            logger.info(`[Job] Deleted ${deletedCount} old notifications`);
        } catch (err) {
            logger.error(`[Job] Error in Notification Cleanup: ${err}`);
        }

        // Check for dues pending more than 3 days
        logger.info("[Job] Checking for overdue dues...");
        try {
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
                    (Date.now() - due.created_at.getTime()) /
                        (1000 * 60 * 60 * 24)
                );

                await notifyOwnerDuePending(
                    due.kiosk.owner_id,
                    due.kiosk.name,
                    due.amount.toString(),
                    daysPending
                );
            }

            logger.info(
                `[Job] Notified owners about ${overdueDues.length} overdue dues`
            );
        } catch (err) {
            logger.error(`[Job] Error checking overdue dues: ${err}`);
        }
    });

    logger.info("[Job] Notification Cleanup Job initialized (00:05 daily)");
}
