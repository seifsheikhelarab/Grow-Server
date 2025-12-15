import express, { Express, Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import { config } from "./config/env.config.js";
import logger from "./utils/logger.js";
import prisma from "./prisma.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { globalLimiter } from "./middlewares/ratelimit.middleware.js";
import { ResponseHandler } from "./utils/response.js";
import apiRoutes from "./api/index.js";
import swaggerSetup from "./utils/swagger.js";

const app: Express = express();

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true
    })
);

// Global rate limiting
app.use(globalLimiter);

/**
 * Health check endpoint.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
app.get("/health", (req: Request, res: Response) => {
    ResponseHandler.success(res, "Server is healthy", {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        env: config.NODE_ENV
    });
});

swaggerSetup(app);
app.use("/api/v1", apiRoutes);

/**
 * Error Handling
 */

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Database Connection & Server Startup.
 * Connects to the database and starts the Express server.
 * Sets up graceful shutdown on SIGTERM and SIGINT.
 */
export async function startServer() {
    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;
        logger.info("Database connected successfully");

        const port = config.PORT;
        const server = app.listen(port, () => {
            logger.info(
                `Server running on port ${port} in ${config.NODE_ENV} mode`
            );
            logger.info(`Health check: http://localhost:${port}/health`);
            logger.info(`Swagger docs: http://localhost:${port}/docs`);
        });

        /**
         * Graceful Shutdown
         */
        process.on("SIGTERM", async () => {
            logger.info("SIGTERM received, shutting down gracefully...");
            server.close(async () => {
                await prisma.$disconnect();
                logger.info("Server closed");
                process.exit(0);
            });
        });

        process.on("SIGINT", async () => {
            logger.info("SIGINT received, shutting down gracefully...");
            server.close(async () => {
                await prisma.$disconnect();
                logger.info("Server closed");
                process.exit(0);
            });
        });
    } catch (err) {
        logger.error(`Failed to start server: ${err}`);
        process.exit(1);
    }
}

export default app;
