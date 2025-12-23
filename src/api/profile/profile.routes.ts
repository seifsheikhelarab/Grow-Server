import { Router } from "express";
import * as profileController from "./profile.controller.js";
import {
    authMiddleware,
    roleGuard,
} from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { updateProfileSchema } from "../../schemas/validation.schema.js";

const router = Router();

// All kiosk routes require authentication
router.use(authMiddleware);

router.route("/").get(roleGuard("OWNER"), profileController.getProfile).put(validateRequest(updateProfileSchema), profileController.updateProfile);
router.route("/worker").get(roleGuard("WORKER"), profileController.getWorkerProfile);
export default router;
