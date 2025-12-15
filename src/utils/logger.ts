import { pino } from "pino";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isDev = process.env.NODE_ENV !== "production";

const logger = isDev
	? pino({
		level: process.env.LOG_LEVEL || "debug",
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				singleLine: false,
				ignore: "pid,hostname",
			},
		},
		timestamp: pino.stdTimeFunctions.isoTime,
	})
	: pino({
		level: process.env.LOG_LEVEL || "info",
		timestamp: pino.stdTimeFunctions.isoTime,
	});

export default logger;
