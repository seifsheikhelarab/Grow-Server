import rateLimit from "express-rate-limit";
import { config } from "../config/env.config.js";

/**
 * Global rate limiter
 * Limits requests based on configuration (default: 100 requests per 15 minutes).
 */
export const globalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Auth rate limiter (stricter)
 * Limits authentication attempts to prevent brute force attacks.
 * 5 attempts per 15 minutes.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: "Too many authentication attempts, please try again later",
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * OTP rate limiter
 * Limits OTP requests to prevent abuse.
 * 3 OTP requests per hour.
 */
export const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 OTP requests per hour
    message: "Too many OTP requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Transaction rate limiter
 * Limits transaction requests.
 * 10 transactions per minute.
 */
export const transactionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 transactions per minute
    message: "Too many transactions, please try again later",
    standardHeaders: true,
    legacyHeaders: false
});
