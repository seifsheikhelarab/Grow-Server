import { Request, Response } from "express";
import * as kioskService from "./kiosk.service.js";
import { ErrorCode, ResponseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

/**
 * Create new kiosk.
 *
 * @param {Request} req - The Express request object containing name, kiosk_type, and location in body.
 * @param {Response} res - The Express response object.
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { name, kiosk_type } = req.body;

    const kiosk = await kioskService.createKiosk(
        ownerId,
        name,
        kiosk_type,
        req,
        res
    );

    if (res.headersSent) return;

    ResponseHandler.created(res, "Kiosk created successfully", {
        id: kiosk.id,
        name: kiosk.name,
        kiosk_type: kiosk.kiosk_type,
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
        const { workerPhone, name } = req.body;
        const { kioskId } = req.params;

        const profile = await kioskService.inviteWorker(
            ownerId,
            kioskId,
            workerPhone,
            name,
            req,
            res
        );

        if (res.headersSent) return;

        ResponseHandler.created(res, "Worker invited successfully", {
            id: profile.id,
            user_id: profile.user_id,
            kiosk_id: profile.kiosk_id,
            name: profile.name,
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

        if (res.headersSent) return;

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
        const { action } = req.body;

        const profile = await kioskService.acceptInvitation(
            invitationId,
            workerId,
            action,
            req,
            res
        );

        if (res.headersSent) return;

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

    if (res.headersSent) return;

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

    if (res.headersSent) return;

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

        if (res.headersSent) return;

        ResponseHandler.success(res, "Kiosks retrieved successfully", {
            kiosks
        });
    }
);

/**
 * Remove worker from kiosk.
 *
 * @param {Request} req - The Express request object containing kioskId in params and workerId in body.
 * @param {Response} res - The Express response object.
 */
export const removeWorker = asyncHandler(
    async (req: Request, res: Response) => {
        const { kioskId } = req.params;
        const { workerId } = req.body;

        const result = await kioskService.removeWorker(
            kioskId,
            workerId,
            req,
            res
        );

        if (res.headersSent) return;

        ResponseHandler.success(res, "Worker removed successfully", result);
    }
);

export const kioskDetails = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { kioskId } = req.params;

    const result = await kioskService.getKioskDetails(kioskId, ownerId, req, res);

    if (res.headersSent) return;

    ResponseHandler.success(res, "Kiosk details retrieved successfully", result);
});

export const getReports = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { kioskId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
        return ResponseHandler.error(res, "Month and year are required", ErrorCode.VALIDATION_ERROR);
    }

    const result = await kioskService.getKioskReports(kioskId, ownerId, Number(month), Number(year), req, res);

    if (res.headersSent) return null;

    ResponseHandler.success(res, "Kiosk reports retrieved successfully", result);
    return result;
});

export const getWorkerDetails = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { workerId } = req.params;

    const result = await kioskService.getWorkerDetails(workerId, ownerId, req, res);

    if (res.headersSent) return null;

    ResponseHandler.success(res, "Worker details retrieved successfully", result);
    return result;
});

export const deleteKiosk = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { kioskId } = req.params;

    const result = await kioskService.deleteKiosk(kioskId, ownerId, req, res);

    if (res.headersSent) return null;

    ResponseHandler.success(res, "Kiosk deleted successfully", result);
    return result;
});

export const getWorkerReport = asyncHandler(async (req: Request, res: Response) => {
    const workerId = req.user!.id;
    const { month, year } = req.query;

    if (!month || !year) {
        return ResponseHandler.error(res, "Month and year are required", ErrorCode.VALIDATION_ERROR);
    }

    const result = await kioskService.getWorkerReport(workerId, Number(month), Number(year), req, res);

    if (res.headersSent) return null;

    ResponseHandler.success(res, "Worker report retrieved successfully", result);
    return result;
});
