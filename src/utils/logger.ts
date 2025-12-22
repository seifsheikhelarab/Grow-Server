import { pino } from "pino";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

/**
 * Pino logger configuration.
 * Provides structured logging throughout the application.
 * Configured to use pino-pretty for development.
 */
// let logger: pino.Logger;

// if (process.env.NODE_ENV === "development") {
    const logger = pino({
        level: process.env.LOG_LEVEL || "info",
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                singleLine: false,
                ignore: "pid,hostname"
            }
        },
        timestamp: pino.stdTimeFunctions.isoTime
    });
// } else {
// const logger = pino({
//     level: process.env.LOG_LEVEL || "info",
//     timestamp: false
// });
// }

export default logger;
