import { z } from "zod";
import mongoose from "mongoose";

export const SWorker = z.object({
  phone: z.string().min(11).max(11),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  pointsEarned: z.number().default(0),
  isActive: z.boolean().default(true),
  kiosk: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Kiosk is should be a valid kiosk"),
  owner: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Owner is should be a valid employee"),
  createdAt: z.date().default(() => new Date()),
})

export type IWorker = z.infer<typeof SWorker>