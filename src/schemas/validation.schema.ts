import { z } from 'zod';

/**
 * Auth Schemas
 */
export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export const registerSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['CUSTOMER', 'WORKER', 'OWNER']),
});

export const loginSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Transaction Schemas
 */
export const sendPointsSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  amount: z.number().int().min(1, 'Amount must be at least 1').max(100, 'Amount cannot exceed 100'),
});

/**
 * Wallet Schemas
 */
export const redeemSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  method: z.string().min(3, 'Redemption method required'),
  details: z.string().min(5, 'Redemption details required'),
});

export const createGoalSchema = z.object({
  title: z.string().min(3, 'Goal title must be at least 3 characters'),
  target: z.number().positive('Target amount must be positive'),
  deadline: z.date().optional(),
  type: z.enum(['SAVING', 'WORKER_TARGET']),
});

export const updateGoalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

/**
 * Kiosk Schemas
 */
export const createKioskSchema = z.object({
  name: z.string().min(3, 'Kiosk name must be at least 3 characters'),
  gov: z.string().min(3, 'Governorate required'),
  area: z.string().min(3, 'Area required'),
});

export const inviteWorkerSchema = z.object({
  workerPhone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
});

/**
 * Admin Schemas
 */
export const approveKioskSchema = z.object({
  kioskId: z.string().uuid('Invalid kiosk ID'),
});

export const processRedemptionSchema = z.object({
  reqId: z.string().uuid('Invalid redemption request ID'),
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

export const collectDueSchema = z.object({
  dueId: z.string().uuid('Invalid due ID'),
});

/**
 * Common Pagination Schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
});

export const dashboardFilterSchema = z.object({
  filter: z.enum(['1d', '7d', '30d']).default('7d'),
});
