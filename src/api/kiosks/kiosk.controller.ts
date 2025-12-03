import { Request, Response } from 'express';
import * as kioskService from './kiosk.service';
import { ResponseHandler } from '../../utils/response';
import { asyncHandler } from '../../middlewares/error.middleware';
import logger from '../../utils/logger';

/**
 * Create new kiosk
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { name, kiosk_type, location } = req.body;

  const kiosk = await kioskService.createKiosk(ownerId, name, kiosk_type, location);

  ResponseHandler.created(res, 'Kiosk created successfully', {
    id: kiosk.id,
    name: kiosk.name,
    kiosk_type: kiosk.kiosk_type,
    location: kiosk.location,
    is_approved: kiosk.is_approved,
  });
});

/**
 * Invite worker to kiosk
 */
export const inviteWorker = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { kioskId, workerPhone } = req.body;

  const profile = await kioskService.inviteWorker(ownerId, kioskId, workerPhone, req, res);

  ResponseHandler.created(res, 'Worker invited successfully', {
    id: profile.id,
    user_id: profile.user_id,
    kiosk_id: profile.kiosk_id,
    status: profile.status,
  });
});


/**
 * Get worker invitations
 */
export const getWorkerInvitations = asyncHandler(async (req: Request, res: Response) => {
  const workerId = req.user!.id;

  const invitations = await kioskService.getWorkerInvitations(workerId);

  ResponseHandler.success(res, 'Invitations retrieved successfully', {
    invitations,
  });
});


/**
 * Accept worker invitation
 */
export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const workerId = req.user!.id;

  const profile = await kioskService.acceptInvitation(workerId, req, res);

  ResponseHandler.success(res, 'Invitation accepted successfully', {
    id: profile.id,
    kiosk: profile.kiosk,
    status: profile.status,
  });
});

/**
 * Get kiosk workers
 */
export const getWorkers = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { kioskId } = req.params;

  const workers = await kioskService.getKioskWorkers(kioskId, ownerId, req, res);

  ResponseHandler.success(res, 'Workers retrieved successfully', {
    workers,
  });
});

/**
 * Get kiosk dues
 */
export const getDues = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { kioskId } = req.params;

  const result = await kioskService.getKioskDues(kioskId, ownerId, req, res);

  ResponseHandler.success(res, 'Kiosk dues retrieved successfully', result);
});

/**
 * Get user's kiosks
 */
export const getUserKiosks = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.id;

  const kiosks = await kioskService.getUserKiosks(ownerId);

  ResponseHandler.success(res, 'Kiosks retrieved successfully', {
    kiosks,
  });
});
