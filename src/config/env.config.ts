import prisma from "../prisma.js";
import logger from "../utils/logger.js";

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
    /** Maximum number of kiosks allowed */
    MAX_KIOSKS: number;
    /** Maximum commission rate */
    MAX_COMMISSION_RATE: number;
    /** Maximum transaction amount */
    MAX_TRANSACTION_AMOUNT: number;
    /** Maximum daily transactions */
    MAX_DAILY_TX: number;
    /** Maximum daily transactions to customer */
    MAX_DAILY_TX_TO_CUSTOMER: number;
}

async function loadSystemSettings() {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = settings.reduce(
        (acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        },
        {} as Record<string, string>
    );

    return {
        maxKiosks: parseInt(settingsMap["max_kiosks"] || "0", 10),
        maxCommissionRate: parseInt(settingsMap["commission_rate"] || "0", 10),
        maxTransactionAmount: parseInt(
            settingsMap["max_transaction_amount"] || "0",
            10
        ),
        maxDailyTx: parseInt(settingsMap["max_daily_tx"] || "0", 10),
        maxDailyTxToCustomer: parseInt(
            settingsMap["max_daily_tx_to_customer"] || "0",
            10
        )
    };
}

/**
 * Loads and validates the application configuration from environment variables.
 *
 * @returns {IConfig} The validated configuration object.
 * @throws Will exit the process with code 1 if required environment variables are missing.
 */
export const loadConfig = async (): Promise<IConfig> => {
    const required = ["DATABASE_URL", "JWT_SECRET", "PORT"];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        logger.error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
        process.exit(1);
    }

    const systemSettings = await loadSystemSettings();

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
        ),
        MAX_KIOSKS: systemSettings.maxKiosks,
        MAX_COMMISSION_RATE: systemSettings.maxCommissionRate,
        MAX_TRANSACTION_AMOUNT: systemSettings.maxTransactionAmount,
        MAX_DAILY_TX: systemSettings.maxDailyTx,
        MAX_DAILY_TX_TO_CUSTOMER: systemSettings.maxDailyTxToCustomer
    };
};

/**
 * The loaded application configuration.
 */
export const config: Promise<IConfig> = loadConfig();
