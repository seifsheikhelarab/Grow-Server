import mongoose from "mongoose";
import { z } from "zod";

export const SKiosk = z.object({
  owner: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Owner is should be a valid employee"),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  type: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  location: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  dues: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
})

export type IKiosk = z.infer<typeof SKiosk>