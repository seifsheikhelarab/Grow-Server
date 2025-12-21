import { Router } from "express";
import * as authController from "./auth.controller.js";
import {
    optionalAuthMiddleware,
    authMiddleware as authMiddlewareAlias,
    tempAuthMiddleware
    // tempAuthMiddleware
} from "../../middlewares/auth.middleware.js";
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from "../../schemas/validation.schema.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";

const router = Router();

/**
 * POST /api/auth/send-otp
 * Send OTP to phone number.
 */
router.post(
    "/send-otp",
    validateRequest(sendOtpSchema),
    authController.sendOtp
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and get token.
 */
router.post(
    "/verify-otp",
    tempAuthMiddleware,
    validateRequest(verifyOtpSchema),
    authController.verifyOtp
);

/**
 * POST /api/auth/register
 * Register new user.
 */
router.post(
    "/register",
    // tempAuthMiddleware,
    validateRequest(registerSchema),
    authController.register
);

/**
 * POST /api/auth/login
 * Login with phone and password.
 */
router.post("/login", validateRequest(loginSchema), authController.login);

/**
 * GET /api/auth/verify
 * Verify authentication status.
 */
router.get("/verify", optionalAuthMiddleware, authController.verifyAuth);

/**
 * DELETE /api/auth/delete-account
 * Delete user account.
 * Protected: Authenticated users.
 */
router.delete(
    "/delete-account",
    authMiddlewareAlias,
    authController.deleteAccount
);

router.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", tempAuthMiddleware, validateRequest(resetPasswordSchema), authController.resetPassword);

export default router;
