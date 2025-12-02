import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/response';

/**
 * Validation Middleware Factory
 * Creates a middleware that validates request body, query, or params using Zod
 */
export const validateRequest = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        throw new ValidationError('Validation failed', errors);
      }

      // Replace the data with validated and parsed data
      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        req.query = result.data as any;
      } else {
        req.params = result.data as any;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
