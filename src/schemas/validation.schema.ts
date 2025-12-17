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
        .length(4, "OTP must be 4 digits")
        .regex(/^\d+$/, "OTP must be numeric")
});

/** Schema for user registration */
export const registerSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    full_name: z.string().min(2, "Full name required"),
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
    amount: z.number().int().positive("Amount must be positive"),
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
    location: z.string().min(3).optional()
});

/** Schema for inviting a worker */
export const inviteWorkerSchema = z.object({
    workerPhone: z
        .string()
        .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    kioskId: z.string().uuid("Invalid kiosk ID"),
    position: z.string().optional(),
    workingHours: z.string().optional()
});

/**
 * Admin Schemas
 */

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

/** Schema for updating system setting */
export const updateSettingSchema = z.object({
    key: z.enum([
        "commission_rate",
        "max_transaction_amount",
        "max_daily_tx",
        "max_daily_tx_to_customer",
        "max_kiosks"
    ]),
    value: z.any(),
    description: z.string().optional()
});

/** Schema for creating admin */
export const createAdminSchema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
    fullName: z.string().min(2, "Full name is required"),
    password: z.string().min(8, "Password must be at least 8 chars"),
    adminRole: z.enum(["SUPER_ADMIN", "EDITOR", "VIEWER"])
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

/**
 * Admin User Management Schemas
 */

export const updateUserStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED", "PENDING", "REJECTED"]),
    note: z.string().optional()
});

export const updateIdStatusSchema = z.object({
    status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
    rejectionReason: z.string().optional()
});

export const manualUserUpdateSchema = z.object({
    full_name: z.string().min(2).optional(),
    phone: z
        .string()
        .regex(/^\+?[0-9]{10,15}$/)
        .optional(),
    email: z.string().email().optional(),
    role: z.enum(["CUSTOMER", "WORKER", "OWNER"]).optional()
});

export const adjustBalanceSchema = z.object({
    amount: z.number().int(), // Can be negative for deduction
    reason: z.string().min(5)
});

/**
 * Admin Kiosk Management Schemas
 */

export const adminCreateKioskSchema = z.object({
    name: z.string().min(3),
    ownerPhone: z.string().regex(/^\+?[0-9]{10,15}$/),
    location: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
});

export const updateKioskStatusSchema = z.object({
    is_active: z.boolean(),
    reason: z.string().optional()
});

export const reassignWorkerSchema = z.object({
    kioskId: z.string().uuid()
});

export const setGoalSchema = z.object({
    workerId: z.string().uuid(),
    targetAmount: z.number().int().positive("Target amount must be positive")
});
