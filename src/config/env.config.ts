import logger from "../utils/logger";

/**
 * Interface representing the application configuration.
 */
export interface IConfig {
    /** Database connection string */
    DATABASE_URL: string;
    /** Secret key for signing JWTs */
    JWT_SECRET: string;
    /** Expiration time for JWTs (e.g., "7d", "1h") */
    JWT_EXPIRY: string;
    /** Port number the server listens on */
    PORT: number;
    /** Node environment (development, production, test) */
    NODE_ENV: string;
    /** Logging level (info, debug, error, etc.) */
    LOG_LEVEL: string;
    /** Rate limiting window in milliseconds */
    RATE_LIMIT_WINDOW_MS: number;
    /** Maximum number of requests allowed within the rate limit window */
    RATE_LIMIT_MAX_REQUESTS: number;
}

/**
 * Loads and validates the application configuration from environment variables.
 * 
 * @returns {IConfig} The validated configuration object.
 * @throws Will exit the process with code 1 if required environment variables are missing.
 */
export const loadConfig = (): IConfig => {
    const required = ["DATABASE_URL", "JWT_SECRET", "PORT"];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        logger.error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
        process.exit(1);
    }

    return {
        // Database
        DATABASE_URL: process.env.DATABASE_URL!,

        // JWT
        JWT_SECRET: process.env.JWT_SECRET!,
        JWT_EXPIRY: process.env.JWT_EXPIRY || "7d",

        // Server
        PORT: parseInt(process.env.PORT || "3000", 10),
        NODE_ENV: process.env.NODE_ENV || "development",

        // Logger
        LOG_LEVEL: process.env.LOG_LEVEL || "info",

        // Rate Limiting
        RATE_LIMIT_WINDOW_MS: parseInt(
            process.env.RATE_LIMIT_WINDOW_MS || "900000",
            10
        ),
        RATE_LIMIT_MAX_REQUESTS: parseInt(
            process.env.RATE_LIMIT_MAX_REQUESTS || "100",
            10
        )
    };
};

/**
 * The loaded application configuration.
 */
export const config: IConfig = loadConfig();
