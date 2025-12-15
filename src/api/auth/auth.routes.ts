import { Router } from "express";
import * as authController from "./auth.controller";
import {
    optionalAuthMiddleware,
    authMiddleware as authMiddlewareAlias
    // tempAuthMiddleware
} from "../../middlewares/auth.middleware";
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
    loginSchema
} from "../../schemas/validation.schema";
import { validateRequest } from "../../middlewares/validate.middleware";

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
router.delete("/delete-account", authMiddlewareAlias, authController.deleteAccount);

export default router;
