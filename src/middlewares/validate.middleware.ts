import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { errorHandler } from "./error.middleware.js";

/**
 * Validation Middleware Factory
 * Creates a middleware that validates request body, query, or params using Zod.
 *
 * @param {ZodSchema} schema - The Zod schema to validate against.
 * @param {"body" | "query" | "params"} source - The part of the request to validate (default: "body").
 * @returns {Function} Express middleware function.
 */
export const validateRequest = (
    schema: ZodSchema,
    source: "body" | "query" | "params" = "body"
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const data =
                source === "body"
                    ? req.body
                    : source === "query"
                        ? req.query
                        : req.params;

            const result = schema.safeParse(data);

            if (!result.success) {
                result.error.errors.reduce(
                    (acc, err) => {
                        const path = err.path.join(".");
                        acc[path] = err.message;
                        return acc;
                    },
                    {} as Record<string, string>
                );
                errorHandler(result.error, req, res);
                return;
            }

            // Replace the data with validated and parsed data
            if (source === "body") {
                req.body = result.data;
            } else if (source === "query") {
                req.query = result.data;
            } else {
                req.params = result.data;
            }

            next();
        } catch (err) {
            errorHandler(err, req, res);
            return;
        }
    };
};
