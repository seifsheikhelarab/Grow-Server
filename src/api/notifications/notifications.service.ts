import prisma from "../../prisma.js";
import logger from "../../utils/logger.js";
import { errorHandler } from "../../middlewares/error.middleware.js";
import { Request, Response } from "express";

export async function getOwnerNotifications(ownerId: string, req: Request, res: Response) {
    try {
        const kiosks = await prisma.kiosk.findMany({
            where: {
                owner_id: ownerId
            },
            select: { id: true }
        });

        if (kiosks.length === 0) {
            return [];
        }

        const kioskIds = kiosks.map(k => k.id);


        const transactions = await prisma.transaction.findMany({
            where: {
                kiosk_id: { in: kioskIds }
            },
            include: {
                sender: true,
            },
            orderBy: {
                created_at: "desc"
            },
            take: 10
        });

        const notifications = transactions.map(t => {
            return {
                body: `${t.sender.full_name} sent ${t.amount_gross} to ${t.receiver_phone} on ${t.created_at.toLocaleString()}`,
                type: "Transaction",
                date: t.created_at.toLocaleString()
            };
        });

        logger.info(`Notifications fetched for owner ${ownerId}`);

        return notifications;
    } catch (error) {
        errorHandler(error, req, res);
        return [];
    }
}

export async function getWorkerNotifications(
    workerId: string,
    req: Request,
    res: Response
) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                sender_id: workerId
            },
            orderBy: {
                created_at: "desc"
            },
            take: 10
        });

        const notifications = transactions.map(t => {
            return {
                body: `You sent ${t.amount_gross} to ${t.receiver_phone} on ${t.created_at.toLocaleString()}`,
                type: "Transaction",
                date: t.created_at.toLocaleString()
            };
        });

        logger.info(`Notifications fetched for worker ${workerId}`);

        return notifications;
    } catch (error) {
        errorHandler(error, req, res);
        return [];
    }
}