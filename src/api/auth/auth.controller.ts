import { Request, Response } from "express";
import * as authService from "./auth.service.js";
import {
    AuthenticationError,
    ErrorCode,
    ResponseHandler
} from "../../utils/response.js";
import {
    asyncHandler,
    errorHandler
} from "../../middlewares/error.middleware.js";

/**
 * Send OTP to phone number.
 *
 * @param {Request} req - The Express request object containing phone number in body.
 * @param {Response} res - The Express response object.
 */
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    const result = await authService.sendOtp(phone, req, res);

    ResponseHandler.success(res, "OTP sent successfully", {
        message: result.message,
        token: result.token
    });
});

/**
 * Verify OTP and authenticate user.
 *
 * @param {Request} req - The Express request object containing phone and code in body.
 * @param {Response} res - The Express response object.
 */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;

    const phone = req.user?.phone;

    if (!phone) {
        errorHandler(
            new AuthenticationError(
                "User not authenticated",
                ErrorCode.UNAUTHORIZED_ACCESS
            ),
            req,
            res
        );
        return;
    }

    const result = await authService.verifyOtp(phone, code, req, res);

    if (!result.userExists || !result.token) {
        errorHandler(
            new AuthenticationError(
                "User does not exist",
                ErrorCode.INVALID_TOKEN
            ),
            req,
            res
        );
        return;
    }

    ResponseHandler.success(res, "OTP verified successfully", {
        token: result.token
    });
});

/**
 * Register new user.
 *
 * @param {Request} req - The Express request object containing phone, password, and role in body.
 * @param {Response} res - The Express response object.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const { phone, password, role, full_name } = req.body;

    const result = await authService.register(
        phone,
        password,
        full_name,
        role,
        req,
        res
    );

    ResponseHandler.created(res, "User registered successfully", {
        id: result.id,
        name: result.full_name,
        phone: result.phone,
        role: result.role,
        token: result.token
    });
});

/**
 * Login with phone and password.
 *
 * @param {Request} req - The Express request object containing phone and password in body.
 * @param {Response} res - The Express response object.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const { phone, password } = req.body;

    const result = await authService.login(phone, password, req, res);

    ResponseHandler.success(res, "Login successful", {
        id: result.id,
        name: result.full_name,
        phone: result.phone,
        role: result.role,
        token: result.token
    });
});

/**
 * Verify authentication status.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const verifyAuth = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        return ResponseHandler.success(res, "Not authenticated", {
            authenticated: false
        });
    }

    return ResponseHandler.success(res, "Authenticated", {
        authenticated: true,
        user: req.user
    });
});

/**
 * Delete user account.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const deleteAccount = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            // Should be caught by auth middleware
            errorHandler(
                new AuthenticationError(
                    "User not authenticated",
                    ErrorCode.UNAUTHORIZED_ACCESS
                ),
                req,
                res
            );
            return;
        }

        await authService.deleteAccount(userId, req, res);

        ResponseHandler.success(res, "Account deleted successfully", {
            deleted: true
        });
    }
);

/**
 * Initiate forgot password flow.
 *
 * @param {Request} req - The Express request object containing phone in body.
 * @param {Response} res - The Express response object.
 */
export const forgotPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const { phone } = req.body;

        const result = await authService.forgotPassword(phone, req, res);

        ResponseHandler.success(res, "OTP sent successfully", {
            message: result.message,
            token: result.token
        });
    }
);

/**
 * Reset password with new password.
 *
 * @param {Request} req - The Express request object containing password in body.
 * @param {Response} res - The Express response object.
 */
export const resetPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const { password } = req.body;

        const phone = req.user?.phone;

        if (!phone) {
            errorHandler(
                new AuthenticationError(
                    "User not authenticated",
                    ErrorCode.UNAUTHORIZED_ACCESS
                ),
                req,
                res
            );
            return;
        }

        const result = await authService.resetPassword(
            phone,
            password,
            req,
            res
        );

        ResponseHandler.success(res, "Password reset successfully", {
            token: result.token
        });
    }
);
