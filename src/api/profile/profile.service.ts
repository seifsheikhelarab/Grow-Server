import type { Request, Response } from "express";
import { errorHandler } from "../../middlewares/error.middleware.js";
import { BusinessLogicError, ErrorCode } from "../../utils/response.js";
import prisma from "../../prisma.js";
import { getTotalNetByAllWorkers } from "../transactions/transaction.service.js";

export async function getProfile(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        if (!userId) {
            errorHandler(new BusinessLogicError("User ID is required", ErrorCode.VALIDATION_ERROR), req, res);
            return null;
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
            select: {
                full_name: true,
                phone: true,
                id: true,
            }
        });

        const balance = await prisma.wallet.findUnique({
            where: {
                user_id: userId
            }
        });

        const totalNet = await getTotalNetByAllWorkers(userId, req, res);

        if (!user) {
            errorHandler(new BusinessLogicError("User not found", ErrorCode.RESOURCE_NOT_FOUND), req, res);
            return null;
        }

        return { user, balance: balance?.balance || 0, totalNet };
    } catch (error) {
        errorHandler(error as Error, req, res);
        return null;
    }
}

export async function updateProfile(
    userId: string,
    full_name: string,
    req: Request,
    res: Response
) {
    try {
        if (!userId) {
            errorHandler(new BusinessLogicError("User ID is required", ErrorCode.VALIDATION_ERROR), req, res);
            return null;
        }

        const user = await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                full_name
            },
            select: {
                full_name: true,
                phone: true,
                id: true,
            }
        });

        if (!user) {
            errorHandler(new BusinessLogicError("User not found", ErrorCode.RESOURCE_NOT_FOUND), req, res);
            return null;
        }

        return user;
    } catch (error) {
        errorHandler(error as Error, req, res);
        return null;
    }
}

export async function getWorkerProfile(
    userId: string,
    req: Request,
    res: Response
) {
    try {
        if (!userId) {
            errorHandler(new BusinessLogicError("User ID is required", ErrorCode.VALIDATION_ERROR), req, res);
            return null;
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
            select: {
                full_name: true,
                phone: true,
                id: true,
            }
        });

        const balance = await prisma.wallet.findUnique({
            where: {
                user_id: userId
            }
        });

        if (!user) {
            errorHandler(new BusinessLogicError("User not found", ErrorCode.RESOURCE_NOT_FOUND), req, res);
            return null;
        }

        return { user, balance: balance?.balance || 0 };
    } catch (error) {
        errorHandler(error as Error, req, res);
        return null;
    }
}
