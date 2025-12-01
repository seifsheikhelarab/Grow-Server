// Configuration for Pino-Pretty Logger
// Used for logging in console and writing to file

import { type Application } from "express";
import morgan from "morgan";
import { pino } from "pino";
import pretty from "pino-pretty";


// Pretty stream for console
const prettyStream = pretty({
  colorize: true,
  translateTime: "yyyy-mm-dd HH:MM:ss",
  ignore: "pid,hostname"
});

export const logger = pino({ level: "info" }, prettyStream);

export default function loggerSetup(app: Application): void {
  app.use(morgan("dev"));
  morgan("combined", {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      }
    }
  });
}
