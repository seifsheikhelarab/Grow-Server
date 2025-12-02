import { Router } from 'express';
import { z } from 'zod';
import * as authController from './auth.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
} from '../../schemas/validation.schema';
import { validateRequest } from '../../middlewares/validate.middleware';

const router = Router();

/**
 * POST /api/auth/send-otp
 * Send OTP to phone number
 */
router.post(
  '/send-otp',
  validateRequest(sendOtpSchema),
  authController.sendOtp
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and get token
 */
router.post(
  '/verify-otp',
  validateRequest(verifyOtpSchema),
  authController.verifyOtp
);

/**
 * POST /api/auth/register
 * Register new user
 */
router.post(
  '/register',
  validateRequest(registerSchema),
  authController.register
);

/**
 * POST /api/auth/login
 * Login with phone and password
 */
router.post(
  '/login',
  validateRequest(loginSchema),
  authController.login
);

/**
 * GET /api/auth/verify
 * Verify authentication status
 */
router.get(
  '/verify',
  optionalAuthMiddleware,
  authController.verifyAuth
);

export default router;
