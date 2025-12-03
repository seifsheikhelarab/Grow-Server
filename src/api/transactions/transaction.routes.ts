import { Router } from 'express';
import * as transactionController from './transaction.controller';
import { authMiddleware, roleGuard } from '../../middlewares/auth.middleware';
import { sendPointsSchema } from '../../schemas/validation.schema';
import { validateRequest } from '../../middlewares/validate.middleware';
import { transactionLimiter } from '../../middlewares/ratelimit.middleware';

const router = Router();

// All transaction routes require authentication and worker/owner role
router.use(authMiddleware);
router.use(roleGuard('WORKER', 'OWNER'));

/**
 * POST /api/transactions
 * Send points to customer
 */
router.post(
  '/',
  transactionLimiter,
  validateRequest(sendPointsSchema),
  transactionController.sendPoints
);

/**
 * GET /api/transactions/
 * Get transaction history
 */
router.get('/', transactionController.getHistory);

/**
 * GET /api/transactions/daily-stats
 * Get daily transaction statistics
 */
router.get('/daily-stats', transactionController.getDailyStats);

export default router;
