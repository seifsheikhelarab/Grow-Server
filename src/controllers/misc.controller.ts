import type { Request, Response } from "express";

export function rateLimiter(_req: Request, res: Response) {
  return res
    .status(429)
    .json({ message: "Too many requests, please try again later." });
}

export function healthCheck(_req: Request, res: Response) {
  return res.status(200).json({ status: "OK", timestamp: new Date() });
}

export function notFound(_req: Request, res: Response) {
  return res.status(404).json({ message: "Resource not found." });
}

