import cron from "node-cron";
import { checkDailyGoals } from "../api/goals/goals.service.js"; // Adjust path
import logger from "../utils/logger.js";

/**
 * Initialize the daily goals cron job.
 * Runs at 23:59 every day to check and settle recurring goals.
 */
export function initDailyGoalsJob() {
    // Run at 23:59 every day
    // Cron syntax: Minute Hour DayOfMonth Month DayOfWeek
    cron.schedule("59 23 * * *", async () => {
        logger.info("[Job] Running Daily Goals Check...");
        try {
            await checkDailyGoals();
        } catch (err) {
            logger.error(`[Job] Error in Daily Goals Check: ${err}`);
        }
    });

    logger.info("[Job] Daily Goals Job initialized (23:59 daily)");
}
