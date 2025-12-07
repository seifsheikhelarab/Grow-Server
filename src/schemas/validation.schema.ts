import { z } from "zod";

/**
 * Auth Schemas
 */

/** Schema for sending OTP */
export const sendOtpSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format")
});

/** Schema for verifying OTP */
export const verifyOtpSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    code: z
        .string()
        .length(6, "OTP must be 6 digits")
        .regex(/^\d+$/, "OTP must be numeric")
});

/** Schema for user registration */
export const registerSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    password: z
        .string()
        .regex(/^[a-zA-Z0-9]{8,}$/, "Password must be at least 8 characters"),
    role: z.enum(["CUSTOMER", "WORKER", "OWNER"])
});

/** Schema for user login */
export const loginSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    password: z
        .string()
        .regex(/^[a-zA-Z0-9]{8,}$/, "Password must be at least 8 characters")
});

/**
 * Transaction Schemas
 */

/** Schema for sending points */
export const sendPointsSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    amount: z
        .number()
        .int()
        .min(5, "Amount must be at least 5")
        .max(100, "Amount cannot exceed 100"),
    kioskId: z.string().uuid("Invalid kiosk ID")
});

/**
 * Wallet Schemas
 */

/** Schema for redeeming points */
export const redeemSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    method: z.string().min(3, "Redemption method required"),
    details: z.string().min(5, "Redemption details required")
});

/** Schema for creating a goal */
export const createGoalSchema = z.object({
    title: z.string().min(3, "Goal title must be at least 3 characters"),
    target: z.number().positive("Target amount must be positive"),
    deadline: z.coerce.date().optional(),
    type: z.enum(["SAVING", "WORKER_TARGET"])
});

/** Schema for updating a goal */
export const updateGoalSchema = z.object({
    amount: z.number().positive("Amount must be positive")
});

/**
 * Kiosk Schemas
 */

/** Schema for creating a kiosk */
export const createKioskSchema = z.object({
    name: z.string().min(3, "Kiosk name must be at least 3 characters"),
    kiosk_type: z.string().min(3, "type required"),
    location: z.string().min(3).optional(),
});

/** Schema for inviting a worker */
export const inviteWorkerSchema = z.object({
    workerPhone: z
        .string()
        .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    kioskId: z.string().uuid("Invalid kiosk ID")
});

/**
 * Admin Schemas
 */

/** Schema for approving a kiosk */
export const approveKioskSchema = z.object({
    kioskId: z.string().uuid("Invalid kiosk ID")
});

/** Schema for processing a redemption request */
export const processRedemptionSchema = z.object({
    reqId: z.string().uuid("Invalid redemption request ID"),
    action: z.enum(["APPROVE", "REJECT"]),
    note: z.string().optional()
});

/** Schema for collecting due */
export const collectDueSchema = z.object({
    dueId: z.string().uuid("Invalid due ID")
});

/**
 * Common Pagination Schema
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100, "Limit cannot exceed 100")
        .default(10)
});

/** Schema for dashboard filtering */
export const dashboardFilterSchema = z.object({
    filter: z.enum(["1d", "7d", "30d"]).default("7d")
});
