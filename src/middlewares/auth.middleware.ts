import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.config';
import { AuthenticationError, AuthorizationError, ErrorCode } from '../utils/response';
import logger from '../utils/logger';
import { errorHandler } from './error.middleware';
import prisma from '../prisma';

/**
 * Extend Express Request to include user data
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      phone: string;
      role: 'CUSTOMER' | 'WORKER' | 'OWNER' | 'ADMIN';
    };
  }
}

/**
 * Authentication Middleware
 * Validates JWT token and extracts user info
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      errorHandler(new AuthenticationError('Missing authorization token', ErrorCode.UNAUTHORIZED_ACCESS), req, res);
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET as string) as {
      id: string;
      phone: string;
      role: string;
    };

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role as 'CUSTOMER' | 'WORKER' | 'OWNER' | 'ADMIN',
    };

    const user = await prisma.user.findUnique({ where: { phone: decoded.phone } });
    if (!user.is_verified) {
      errorHandler(new AuthenticationError('User not verified', ErrorCode.UNAUTHORIZED_ACCESS), req, res);
      return;
    }

    logger.debug(`User authenticated: ${decoded.phone}`);
    next();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      errorHandler(err, req, res);
      return;
    }

    if (typeof err === 'object' && err !== null && 'name' in err) {
      const errorName = (err as { name: string }).name;
      if (errorName === 'TokenExpiredError') {
        errorHandler(new AuthenticationError('Token expired', ErrorCode.TOKEN_EXPIRED), req, res);
        return;
      }
      if (errorName === 'JsonWebTokenError') {
        errorHandler(new AuthenticationError('Invalid token', ErrorCode.INVALID_TOKEN), req, res);
        return;
      }
    }

    logger.error(`Auth middleware error: ${(err instanceof Error ? err.message : String(err))}`);
    errorHandler(new AuthenticationError('Authentication failed', ErrorCode.INTERNAL_ERROR), req, res);
    return;
  }
};

/**
 * Role Guard Middleware
 * Ensures user has required role
 */
export const roleGuard = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      errorHandler(new AuthenticationError('User not authenticated', ErrorCode.UNAUTHORIZED_ACCESS), req, res);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by ${req.user.phone} with role ${req.user.role}`);
      errorHandler(new AuthorizationError(`Role '${req.user.role}' is not allowed to access this resource`), req, res);
      return;
    }

    next();
  };
};

/**
 * Optional Auth Middleware
 * Validates JWT if present, but doesn't require it
 */
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET) as {
        id: string;
        phone: string;
        role: string;
      };

      req.user = {
        id: decoded.id,
        phone: decoded.phone,
        role: decoded.role as 'CUSTOMER' | 'WORKER' | 'OWNER' | 'ADMIN',
      };

      logger.debug(`Optional auth: User authenticated: ${decoded.phone}`);
    }

    next();
  } catch {
    logger.debug(`Optional auth: Token invalid or expired, continuing without auth`);
    next();
  }
};
