import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../prisma.js";
import { config } from "../../config/env.config.js";
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ErrorCode,
    AppError
} from "../../utils/response.js";
import logger from "../../utils/logger.js";
import { errorHandler } from "../../middlewares/error.middleware.js";
import ms from "ms";
import jwt, { SignOptions } from "jsonwebtoken";
import { sendSMS } from "../../utils/sms.js";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

/**
 * Generate and store OTP.
 *
 * @param {string} phone - The phone number to send OTP to.
 * @returns {Promise<void>}
 */
export async function sendOtp(
    phone: string,
    req: Request,
    res: Response
): Promise<{ message: string; token: string }> {
    try {
        // Generate 4-digit OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Expiry: 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save to database
        await prisma.otp.upsert({
            where: { phone },
            update: { code, expiresAt },
            create: { phone, code, expiresAt }
        });

        await sendSMS(phone, code);
        logger.info(`OTP sent to ${phone}: ${code}`);

        // Generate temporary token for registration
        const opts: SignOptions = { expiresIn: "30m" };
        const tempToken = jwt.sign(
            { phone, tempAuth: true },
            (await config).JWT_SECRET as string,
            opts
        );

        return {
            message: "OTP sent successfully",
            token: tempToken
        };
    } catch (err) {
        logger.error(`Error sending OTP: ${err}`);
        errorHandler(
            new Error("حدث خطأ أثناء إرسال رمز التحقق لمرة واحدة"),
            req,
            res
        );
        return {
            message: "حدث خطأ أثناء إرسال رمز التحقق لمرة واحدة",
            token: ""
        };
    }
}

/**
 * Verify OTP and check if user exists.
 *
 * @param {string} phone - The phone number.
 * @param {string} code - The OTP code.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ userExists: boolean; token: string }>} Result containing user existence status and token.
 */
// Helper to retrieve worker profile
async function getWorkerProfile(userId: string) {
    const profile = await prisma.workerProfile.findFirst({
        where: {
            user_id: userId,
            status: "ACTIVE"
        },
        include: {
            kiosk: { select: { id: true, name: true } }
        }
    });

    if (profile) {
        return {
            id: profile.id,
            kiosk_id: profile.kiosk_id,
            kiosk_name: profile.kiosk.name,
            status: profile.status
        };
    }
    return null;
}

export async function verifyOtp(
    phone: string,
    code: string,
    req: Request,
    res: Response
): Promise<{
    userExists: boolean;
    token: string;
    worker_profile?: {
        id: string;
        kiosk_id: string;
        kiosk_name: string;
        status: string;
    } | null;
}> {
    try {
        // Find OTP record
        const otpRecord = await prisma.otp.findUnique({ where: { phone } });

        if (!otpRecord) {
            errorHandler(
                new NotFoundError(
                    "لم يتم العثور على رمز التحقق لمرة واحدة أو انتهت صلاحيته"
                ),
                req,
                res
            );
            return { userExists: false, token: "" };
        }

        if (otpRecord.expiresAt < new Date()) {
            await prisma.otp.delete({ where: { phone } });
            errorHandler(
                new AuthenticationError(
                    "انتهت صلاحية رمز التحقق لمرة واحدة",
                    ErrorCode.OTP_EXPIRED
                ),
                req,
                res
            );
            return { userExists: false, token: "" };
        }

        if (otpRecord.code !== code) {
            errorHandler(
                new AuthenticationError(
                    "رمز التحقق لمرة واحدة غير صحيح",
                    ErrorCode.INVALID_OTP
                ),
                req,
                res
            );
            return { userExists: false, token: "" };
        }

        // Delete used OTP
        await prisma.otp.delete({ where: { phone } });

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { phone } });

        if (!user) {
            logger.info(`OTP verified for new user: ${phone}`);
            return {
                userExists: true,
                token: ""
            };
        }

        if (!user.is_active) {
            errorHandler(
                new AuthenticationError(
                    "حساب المستخدم غير نشط",
                    ErrorCode.INVALID_TOKEN
                ),
                req,
                res
            );
            return { userExists: false, token: "" };
        }

        await prisma.user.update({
            where: { phone },
            data: { is_verified: true }
        });

        // Generate auth token for existing user
        const opts: SignOptions = {
            expiresIn: (await config).JWT_EXPIRY as ms.StringValue
        };
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            (await config).JWT_SECRET as string,
            opts
        );

        let workerProfile = null;
        if (user.role === "WORKER") {
            workerProfile = await getWorkerProfile(user.id);
        }

        logger.info(`OTP verified and user authenticated: ${phone}`);
        return { userExists: true, token, worker_profile: workerProfile };
    } catch (err) {
        logger.error(`Error verifying OTP: ${err}`);
        errorHandler(
            new Error("حدث خطأ أثناء التحقق من رمز التحقق لمرة واحدة"),
            req,
            res
        );
        return { userExists: false, token: "" };
    }
}

/**
 * Register new user and create wallet.
 *
 * @param {string} phone - The phone number.
 * @param {string} password - The password.
 * @param {"CUSTOMER" | "WORKER" | "OWNER"} role - The user role.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ id: string; full_name: string; phone: string; role: string; token: string }>} The registered user details and token.
 */
export async function register(
    phone: string,
    password: string,
    full_name: string,
    role: "CUSTOMER" | "WORKER" | "OWNER",
    req: Request,
    res: Response
): Promise<{
    id: string;
    full_name: string;
    phone: string;
    role: string;
    token: string;
    worker_profile?: {
        id: string;
        kiosk_id: string;
        kiosk_name: string;
        status: string;
    } | null;
}> {
    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { phone } });
        if (existingUser && existingUser.password_hash) {
            errorHandler(
                new ConflictError("مستخدم موجود بالفعل بهذا الرقم الهاتفي"),
                req,
                res
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user within transaction
        const user = await prisma.user.upsert({
            where: { phone },
            update: {
                full_name,
                password_hash: passwordHash,
                role,
                is_verified: false
            },
            create: {
                phone,
                full_name,
                password_hash: passwordHash,
                role,
                is_verified: false
            }
        });

        // Create wallet
        await prisma.wallet.upsert({
            where: { user_id: user.id },
            update: {
                user_id: user.id
            },
            create: {
                user_id: user.id
            }
        });

        // Check for shadow wallet (unclaimed points)
        const shadowWallet = await prisma.shadowWallet.findUnique({
            where: { phone }
        });

        if (shadowWallet) {
            // Move shadow wallet balance to real wallet
            await prisma.wallet.update({
                where: { user_id: user.id },
                data: { balance: shadowWallet.balance }
            });

            // Delete shadow wallet
            await prisma.shadowWallet.delete({ where: { phone } });

            logger.info(
                `Shadow wallet claimed for ${phone}: ${shadowWallet.balance} points`
            );
        }

        // Generate auth token
        const opts: SignOptions = {
            expiresIn: (await config).JWT_EXPIRY as ms.StringValue
        };
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            (await config).JWT_SECRET as string,
            opts
        );

        let workerProfile = null;
        if (role === "WORKER") {
            workerProfile = await getWorkerProfile(user.id);
        }

        logger.info(`User registered successfully: ${phone} with role ${role}`);
        return {
            id: user.id,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role,
            token,
            worker_profile: workerProfile
        };
    } catch (err) {
        logger.error(`Error registering user: ${err}`);
        errorHandler(
            new AppError(
                "خطأ في تسجيل المستخدم",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return {
            id: "",
            full_name: "",
            phone: "",
            role: "",
            token: ""
        };
    }
}

/**
 * Login with phone and password.
 *
 * @param {string} phone - The phone number.
 * @param {string} password - The password.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ id: string; full_name: string; phone: string; role: string; token: string }>} The logged-in user details and token.
 */
export async function login(
    phone: string,
    password: string,
    req: Request,
    res: Response
): Promise<{
    id: string;
    full_name: string;
    phone: string;
    role: string;
    token: string;
    worker_profile?: {
        id: string;
        kiosk_id: string;
        kiosk_name: string;
        status: string;
    } | null;
}> {
    try {
        const user = await prisma.user.findUnique({ where: { phone } });

        if (!user || !user.password_hash) {
            errorHandler(
                new AuthenticationError("رقم هاتف أو كلمة مرور غير صحيحة"),
                req,
                res
            );
        }

        if (!user.is_active) {
            errorHandler(
                new AuthenticationError(
                    "حساب المستخدم غير نشط",
                    ErrorCode.INVALID_TOKEN
                ),
                req,
                res
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isPasswordValid) {
            errorHandler(
                new AuthenticationError("رقم هاتف أو كلمة مرور غير صحيحة"),
                req,
                res
            );
        }

        // Get first active worker profile for WORKER role
        let workerProfile = null;
        if (user.role === "WORKER") {
            workerProfile = await getWorkerProfile(user.id);
        }

        // Generate auth token
        const opts: SignOptions = {
            expiresIn: (await config).JWT_EXPIRY as ms.StringValue
        };
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            (await config).JWT_SECRET as string,
            opts
        );

        logger.info(`User logged in: ${phone}`);
        return {
            full_name: user.full_name,
            id: user.id,
            phone: user.phone,
            role: user.role,
            token,
            worker_profile: workerProfile
        };
    } catch (err) {
        logger.error(`Error logging in: ${err}`);
        errorHandler(
            new AppError(
                "حدث خطأ أثناء تسجيل الدخول",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
        return {
            full_name: "",
            id: "",
            phone: "",
            role: "",
            token: ""
        };
    }
}

/**
 * Verify JWT token.
 *
 * @param {string} token - The JWT token.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ id: string; full_name: string; phone: string; role: string }>} The decoded token payload.
 */
export async function verifyToken(
    token: string,
    req: Request,
    res: Response
): Promise<{
    id: string;
    full_name: string;
    phone: string;
    role: string;
}> {
    try {
        const decoded = jwt.verify(token, (await config).JWT_SECRET) as {
            id: string;
            full_name: string;
            phone: string;
            role: string;
        };
        return decoded;
    } catch (unknownError) {
        const err = unknownError as Error;
        if (err.name === "TokenExpiredError") {
            errorHandler(
                new AuthenticationError(
                    "انتهت صلاحية الرمز المميز",
                    ErrorCode.TOKEN_EXPIRED
                ),
                req,
                res
            );
            return { id: "", full_name: "", phone: "", role: "" };
        }
        errorHandler(
            new AuthenticationError("رمز غير صالح", ErrorCode.INVALID_TOKEN),
            req,
            res
        );
        return { id: "", full_name: "", phone: "", role: "" };
    }
}

/**
 * Delete user account (soft delete).
 *
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<void>}
 */
export async function deleteAccount(
    userId: string,
    req: Request,
    res: Response
): Promise<void> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { is_active: false }
        });
        logger.info(`User account deleted (soft): ${userId}`);
    } catch (err) {
        logger.error(`Error deleting account: ${err}`);
        errorHandler(
            new AppError(
                "حدث خطأ أثناء حذف الحساب",
                500,
                ErrorCode.INTERNAL_ERROR
            ),
            req,
            res
        );
    }
}

/**
 * Initiate forgot password flow.
 * @param {string} phone - The phone number.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ message: string; token: string }>} Result containing message and token.
 */
export async function forgotPassword(
    phone: string,
    req: Request,
    res: Response
): Promise<{ message: string; token: string }> {
    try {
        // Generate 4-digit OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Expiry: 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save to database
        await prisma.otp.upsert({
            where: { phone },
            update: { code, expiresAt },
            create: { phone, code, expiresAt }
        });

        await sendSMS(phone, code);
        logger.info(`OTP sent to ${phone}: ${code}`);

        // Generate temporary token for registration
        const opts: SignOptions = { expiresIn: "30m" };
        const tempToken = jwt.sign(
            { phone, tempAuth: true },
            (await config).JWT_SECRET as string,
            opts
        );

        return {
            message: "تم إرسال رمز التحقق لمرة واحدة بنجاح",
            token: tempToken
        };
    } catch (err) {
        logger.error(`Error sending OTP: ${err}`);
        errorHandler(err, req, res);
        return {
            message: "حدث خطأ أثناء إرسال رمز التحقق لمرة واحدة",
            token: ""
        };
    }
}

/**
 * Reset password.
 * @param {string} phone - The phone number.
 * @param {string} password - The new password.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ message: string; token: string }>} Result containing message and token.
 */
export async function resetPassword(
    phone: string,
    password: string,
    req: Request,
    res: Response
): Promise<{
    message: string;
    token: string;
    worker_profile?: {
        id: string;
        kiosk_id: string;
        kiosk_name: string;
        status: string;
    } | null;
}> {
    try {
        // Find user by phone
        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user) {
            errorHandler(
                new AuthenticationError("لم يتم العثور على المستخدم"),
                req,
                res
            );
        }

        // Update password
        await prisma.user.update({
            where: { phone },
            data: { password_hash: await bcrypt.hash(password, 10) }
        });

        logger.info(`Password reset for ${phone}`);

        // Generate auth token
        const opts: SignOptions = { expiresIn: "30m" };
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            (await config).JWT_SECRET as string,
            opts
        );

        let workerProfile = null;
        if (user.role === "WORKER") {
            workerProfile = await getWorkerProfile(user.id);
        }

        return {
            message: "Password reset successfully",
            token,
            worker_profile: workerProfile
        };
    } catch (err) {
        logger.error(`Error resetting password: ${err}`);
        errorHandler(err, req, res);
        return {
            message: "خطأ في إعادة تعيين كلمة المرور",
            token: ""
        };
    }
}

/**
 * Resend OTP.
 * @param {string} phone - The phone number.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<{ message: string; token: string }>} Result containing message and token.
 */
export async function resendOtp(
    phone: string,
    req: Request,
    res: Response
): Promise<{ message: string; token: string }> {
    try {
        // Find OTP record
        const otpRecord = await prisma.otp.findUnique({ where: { phone } });

        if (!otpRecord) {
            errorHandler(
                new NotFoundError(
                    "لم يتم العثور على رمز التحقق لمرة واحدة أو انتهت صلاحيته"
                ),
                req,
                res
            );
            return {
                message:
                    "لم يتم العثور على رمز التحقق لمرة واحدة أو انتهت صلاحيته",
                token: ""
            };
        }

        // Delete used OTP
        await prisma.otp.delete({ where: { phone } });

        // Generate temporary token for registration
        const opts: SignOptions = { expiresIn: "30m" };
        const tempToken = jwt.sign(
            { phone, tempAuth: true },
            (await config).JWT_SECRET as string,
            opts
        );

        // Create New OTP Record
        // Generate 4-digit OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Expiry: 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save to database
        await prisma.otp.upsert({
            where: { phone },
            update: { code, expiresAt },
            create: { phone, code, expiresAt }
        });

        logger.info(`Resending OTP to ${phone}: ${code}`);
        await sendSMS(phone, code);

        return {
            message: "تم إرسال رمز التحقق لمرة واحدة بنجاح",
            token: tempToken
        };
    } catch (err) {
        logger.error(`Error sending OTP: ${err}`);
        errorHandler(err, req, res);
        return {
            message: "حدث خطأ أثناء إرسال رمز التحقق لمرة واحدة",
            token: ""
        };
    }
}
