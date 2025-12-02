import logger from '../utils/logger';

export interface IConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

export const loadConfig = (): IConfig => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PORT',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  return {
    // Database
    DATABASE_URL: process.env.DATABASE_URL!,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',

    // Server
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Logger
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  };
};

export const config: IConfig = loadConfig();
