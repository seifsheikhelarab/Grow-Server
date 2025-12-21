import { Router } from "express";
import * as kioskController from "./kiosk.controller.js";
import {
    authMiddleware,
    roleGuard
} from "../../middlewares/auth.middleware.js";
import {
    createKioskSchema,
    invitationResponseSchema,
    inviteWorkerSchema,
    removeWorkerSchema
} from "../../schemas/validation.schema.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";

const router = Router();

// All kiosk routes require authentication
router.use(authMiddleware);

/**
 * POST /api/kiosks/
 * Create new kiosk (Owner only).
 */
/**
 * GET /api/kiosks/
 * Get user's kiosks.
 */
router
    .route("/")
    .post(
        roleGuard("OWNER"),
        validateRequest(createKioskSchema),
        kioskController.create
    )
    .get(roleGuard("OWNER"), kioskController.getUserKiosks);

/**
 * POST /api/kiosks/invite
 * Invite worker to kiosk (Owner only).
 */
router
    .route("/invite")
    .post(
        roleGuard("OWNER"),
        validateRequest(inviteWorkerSchema),
        kioskController.inviteWorker
    );

/**
 * GET /api/kiosks/invitations
 * Get kiosk invitations (Worker only).
 */
router
    .route("/invitations")
    .get(roleGuard("WORKER"), kioskController.getWorkerInvitations);

/**
 * POST /api/kiosks/accept-invitation/:invitationId
 * Respond to worker invitation (Worker only).
 */
router
    .route("/invitations/:invitationId")
    .post(
        roleGuard("WORKER"),
        validateRequest(invitationResponseSchema),
        kioskController.acceptInvitation
    );

/**
 * GET /api/kiosks/:kioskId/workers
 * Get kiosk workers (Owner only).
 */
router
    .route("/:kioskId/workers")
    .get(roleGuard("OWNER"), kioskController.getWorkers)
    .delete(
        roleGuard("OWNER"),
        validateRequest(removeWorkerSchema),
        kioskController.removeWorker
    );

/**
 * GET /api/kiosks/:kioskId/dues
 * Get kiosk dues (Owner only).
 */
router.get("/:kioskId/dues", roleGuard("OWNER"), kioskController.getDues);

export default router;
