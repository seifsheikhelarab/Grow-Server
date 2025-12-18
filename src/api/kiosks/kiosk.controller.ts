import { Request, Response } from "express";
import * as kioskService from "./kiosk.service.js";
import { ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

/**
 * Create new kiosk.
 *
 * @param {Request} req - The Express request object containing name, kiosk_type, and location in body.
 * @param {Response} res - The Express response object.
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { name, kiosk_type, location } = req.body;

    const kiosk = await kioskService.createKiosk(
        ownerId,
        name,
        kiosk_type,
        location,
        req,
        res
    );

    ResponseHandler.created(res, "Kiosk created successfully", {
        id: kiosk.id,
        name: kiosk.name,
        kiosk_type: kiosk.kiosk_type,
        location: kiosk.location
    });
});

/**
 * Invite worker to kiosk.
 * @async
 * @param {Request} req - The Express request object containing kioskId and workerPhone in body.
 * @param {Response} res - The Express response object.
 */
export const inviteWorker = asyncHandler(
    async (req: Request, res: Response) => {
        const ownerId = req.user!.id;
        const { kioskId, workerPhone, position, workingHours } = req.body;

        const profile = await kioskService.inviteWorker(
            ownerId,
            kioskId,
            workerPhone,
            position,
            workingHours,
            req,
            res
        );

        ResponseHandler.created(res, "Worker invited successfully", {
            id: profile.id,
            user_id: profile.user_id,
            kiosk_id: profile.kiosk_id,
            status: profile.status
        });
    }
);

/**
 * Get worker invitations.
 * @async
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getWorkerInvitations = asyncHandler(
    async (req: Request, res: Response) => {
        const workerId = req.user!.id;

        const invitations = await kioskService.getWorkerInvitations(
            workerId,
            req,
            res
        );

        ResponseHandler.success(res, "Invitations retrieved successfully", {
            invitations
        });
    }
);

/**
 * Accept worker invitation.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const acceptInvitation = asyncHandler(
    async (req: Request, res: Response) => {
        const workerId = req.user!.id;
        const { invitationId } = req.params;

        const profile = await kioskService.acceptInvitation(
            invitationId,
            workerId,
            req,
            res
        );

        ResponseHandler.success(res, "Invitation accepted successfully", {
            id: profile.id,
            kiosk: profile.kiosk,
            status: profile.status
        });
    }
);

/**
 * Get kiosk workers.
 *
 * @param {Request} req - The Express request object containing kioskId in params.
 * @param {Response} res - The Express response object.
 */
export const getWorkers = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { kioskId } = req.params;

    const workers = await kioskService.getKioskWorkers(
        kioskId,
        ownerId,
        req,
        res
    );

    ResponseHandler.success(res, "Workers retrieved successfully", {
        workers
    });
});

/**
 * Get kiosk dues.
 *
 * @param {Request} req - The Express request object containing kioskId in params.
 * @param {Response} res - The Express response object.
 */
export const getDues = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { kioskId } = req.params;

    const result = await kioskService.getKioskDues(kioskId, ownerId, req, res);

    ResponseHandler.success(res, "Kiosk dues retrieved successfully", result);
});

/**
 * Get user's kiosks.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 */
export const getUserKiosks = asyncHandler(
    async (req: Request, res: Response) => {
        const ownerId = req.user!.id;

        const kiosks = await kioskService.getUserKiosks(ownerId, req, res);

        ResponseHandler.success(res, "Kiosks retrieved successfully", {
            kiosks
        });
    }
);
