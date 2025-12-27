import { Router, Request, Response } from "express";
import prisma from "../../prisma.js";
const router = Router();

router.get("/", async (req: Request, res: Response) => {
    const otps = await prisma.otp.findMany({});
    return res.json(otps);
});

router.get("/:phone", async (req: Request, res: Response) => {
    const otp = await prisma.otp.findUnique({
        where: {
            phone: req.params.phone
        }
    });
    return res.json(otp);
});

export default router;
