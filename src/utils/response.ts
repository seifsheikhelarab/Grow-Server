import { Response } from "express";
import logger from "./logger";

/**
 * HTTP Status Codes
 */
export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503
}

/**
 * Error Codes for consistent API responses
 */
export enum ErrorCode {
    // Auth Errors (1xxx)
    INVALID_CREDENTIALS = "AUTH_001",
    TOKEN_EXPIRED = "AUTH_002",
    INVALID_TOKEN = "AUTH_003",
    UNAUTHORIZED_ACCESS = "AUTH_004",
    OTP_EXPIRED = "AUTH_005",
    INVALID_OTP = "AUTH_006",
    USER_NOT_FOUND = "AUTH_007",
    USER_ALREADY_EXISTS = "AUTH_008",

    // Validation Errors (2xxx)
    VALIDATION_ERROR = "VAL_001",
    INVALID_PHONE_FORMAT = "VAL_002",
    INVALID_EMAIL_FORMAT = "VAL_003",
    INVALID_AMOUNT = "VAL_004",
    MISSING_REQUIRED_FIELDS = "VAL_005",

    // Business Logic Errors (3xxx)
    INSUFFICIENT_BALANCE = "BUS_001",
    TRANSACTION_LIMIT_EXCEEDED = "BUS_002",
    DAILY_LIMIT_EXCEEDED = "BUS_003",
    KIOSK_NOT_APPROVED = "BUS_004",
    WORKER_NOT_ACTIVE = "BUS_005",
    INVALID_TRANSACTION_AMOUNT = "BUS_006",
    DAILY_TX_TO_USER_LIMIT = "BUS_007",
    KIOSK_NOT_FOUND = "BUS_008",
    REDEMPTION_LIMIT_EXCEEDED = "BUS_009",

    // Permission Errors (4xxx)
    INSUFFICIENT_PERMISSIONS = "PERM_001",
    ROLE_NOT_ALLOWED = "PERM_002",

    // Resource Errors (5xxx)
    RESOURCE_NOT_FOUND = "RES_001",
    RESOURCE_CONFLICT = "RES_002",
    RESOURCE_ALREADY_EXISTS = "RES_003",

    // Server Errors (9xxx)
    INTERNAL_ERROR = "SRV_001",
    DATABASE_ERROR = "SRV_002",
    EXTERNAL_SERVICE_ERROR = "SRV_003"
}

/**
 * Standard Success Response Interface
 */
export interface SuccessResponse<T> {
    success: true;
    message: string;
    data?: T;
    timestamp: string;
    path?: string;
}

/**
 * Standard Error Response Interface
 */
export interface ErrorResponse {
    success: false;
    message: string;
    errorCode: ErrorCode | string;
    statusCode: HttpStatus;
    timestamp: string;
    path?: string;
    details?: Record<string, unknown>;
}

/**
 * Response Handler Class
 * Provides consistent response formatting across the API
 */
export class ResponseHandler {
    /**
     * Send success response
     */
    static success<T>(
        res: Response,
        message: string,
        data?: T,
        statusCode: HttpStatus = HttpStatus.OK,
        path?: string
    ): Response {
        const response: SuccessResponse<T> = {
            success: true,
            message,
            timestamp: new Date().toISOString(),
            path
        };

        if (data !== undefined) {
            response.data = data;
        }

        logger.info(`[SUCCESS] ${message} - Path: ${path || "N/A"}`);

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response
     */
    static error(
        res: Response,
        message: string,
        errorCode: ErrorCode | string,
        statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
        details?: Record<string, unknown>,
        path?: string
    ): Response {
        const response: ErrorResponse = {
            success: false,
            message,
            errorCode,
            statusCode,
            timestamp: new Date().toISOString(),
            path
        };

        if (details) {
            response.details = details;
        }

        logger.error(
            `[ERROR] ${message} - Code: ${errorCode} - Status: ${statusCode} - Path: ${path || "N/A"}`
        );

        return res.status(statusCode).json(response);
    }

    /**
     * Send paginated response
     */
    static paginated<T>(
        res: Response,
        data: T[],
        message: string,
        page: number,
        limit: number,
        total: number,
        path?: string
    ): Response {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            timestamp: new Date().toISOString(),
            path
        };

        logger.info(
            `[PAGINATED] ${message} - Page: ${page}, Total: ${total} - Path: ${path || "N/A"}`
        );

        return res.status(HttpStatus.OK).json(response);
    }

    /**
     * Send created response
     */
    static created<T>(
        res: Response,
        message: string,
        data: T,
        path?: string
    ): Response {
        return this.success(res, message, data, HttpStatus.CREATED, path);
    }

    /**
     * Send no content response
     */
    static noContent(res: Response, path?: string): Response {
        logger.info(`[NO CONTENT] - Path: ${path || "N/A"}`);
        return res.status(HttpStatus.NO_CONTENT).send();
    }
}

/**
 * Custom Application Error Class
 */
export class AppError extends Error {
    public statusCode: HttpStatus;
    public errorCode: ErrorCode | string;
    public details?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode | string = ErrorCode.INTERNAL_ERROR,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

/**
 * Validation Error Class
 */
export class ValidationError extends AppError {
    public fields?: Record<string, unknown>;
    constructor(
        message: string,
        fields?: Record<string, unknown>,
        details?: Record<string, unknown>
    ) {
        super(
            message,
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            details
        );
        this.fields = fields;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * Authentication Error Class
 */
export class AuthenticationError extends AppError {
    constructor(
        message: string = "Invalid credentials",
        errorCode: ErrorCode = ErrorCode.INVALID_CREDENTIALS
    ) {
        super(message, HttpStatus.UNAUTHORIZED, errorCode);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

/**
 * Authorization Error Class
 */
export class AuthorizationError extends AppError {
    constructor(message: string = "Insufficient permissions") {
        super(
            message,
            HttpStatus.FORBIDDEN,
            ErrorCode.INSUFFICIENT_PERMISSIONS
        );
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}

/**
 * Not Found Error Class
 */
export class NotFoundError extends AppError {
    constructor(message: string = "Resource not found") {
        super(message, HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * Conflict Error Class
 */
export class ConflictError extends AppError {
    constructor(message: string = "Resource already exists") {
        super(message, HttpStatus.CONFLICT, ErrorCode.RESOURCE_CONFLICT);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

/**
 * Business Logic Error Class
 */
export class BusinessLogicError extends AppError {
    public businessErrorCode: ErrorCode;
    constructor(
        message: string,
        businessErrorCode: ErrorCode,
        details?: Record<string, unknown>
    ) {
        super(
            message,
            HttpStatus.UNPROCESSABLE_ENTITY,
            businessErrorCode,
            details
        );
        this.businessErrorCode = businessErrorCode;
        Object.setPrototypeOf(this, BusinessLogicError.prototype);
    }
}
