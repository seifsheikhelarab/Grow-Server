import { Request, Response, NextFunction } from "express";
import {
    ResponseHandler,
    AppError,
    ErrorCode,
    HttpStatus
} from "../utils/response.js";
import logger from "../utils/logger.js";

/**
 * Global Error Handler Middleware
 * Catches all errors and formats them consistently.
 *
 * @param {Error | AppError} err - The error object.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Response} The JSON error response.
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response
) => {
    const path = `${req.method} ${req.path}`;
    const timestamp = new Date().toISOString();

    // Handle AppError instances (our custom errors)
    if (err instanceof AppError) {
        logger.error(
            `[${err.statusCode}] ${err.message} - Code: ${err.errorCode} - Path: ${path} - Time: ${timestamp}`
        );
        return ResponseHandler.error(
            res,
            err.message,
            err.errorCode,
            err.statusCode,
            err.details,
            path
        );
    }

    // Handle Zod validation errors
    if (err.name === "ZodError") {
        type ZodIssue = { path: (string | number)[]; message: string };
        type ZodErrorType = { errors: ZodIssue[] };
        const zodErr = err as unknown as ZodErrorType;
        const details: Record<string, string> = zodErr.errors.reduce(
            (acc, error) => {
                acc[error.path.join(".")] = error.message;
                return acc;
            },
            {}
        );

        logger.warn(`Validation error - Path: ${path}`);
        return ResponseHandler.error(
            res,
            "Validation failed",
            ErrorCode.VALIDATION_ERROR,
            HttpStatus.BAD_REQUEST,
            details,
            path
        );
    }

    // Handle generic errors
    logger.error(`Unhandled error: ${err.message} - Stack: ${err.stack}`);
    return ResponseHandler.error(
        res,
        process.env.NODE_ENV === "production"
            ? "An error occurred"
            : err.message,
        ErrorCode.INTERNAL_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        path
    );
};

/**
 * 404 Not Found Middleware
 * Handles requests to non-existent routes.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const notFoundHandler = (req: Request, res: Response) => {
    const path = `${req.method} ${req.path}`;
    ResponseHandler.error(
        res,
        `Route ${path} not found`,
        ErrorCode.RESOURCE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        undefined,
        path
    );
};

/**
 * Async handler wrapper for Express route handlers
 * Wraps async functions to catch errors and pass them to error handler.
 *
 * @param {Function} fn - The async route handler function.
 * @returns {Function} Express middleware function.
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
