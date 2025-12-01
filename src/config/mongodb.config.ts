//Configuration for connecting to MongoDB database

import dotenv from "dotenv";
dotenv.config({ quiet: true });

import mongoose from "mongoose";
import { logger } from "./logger.config.js";

export default function mongoSetup(): void {
  mongoose
    .connect(process.env.MONGODB_URI!)
    .then(() => logger.info(`Connected to MongoDB database successfully`))
    .catch((err: Error) => {
      logger.error(`Failed to connect to MongoDB database: ${err.message}`);
      process.exit(1);
    });
}
