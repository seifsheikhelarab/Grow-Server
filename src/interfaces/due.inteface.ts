import mongoose from "mongoose";
import { z } from "zod";

export const SDue = z.object({
  kiosk: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Kiosk is should be a valid kiosk"),
  amount: z.number(),
  status: z.enum(["Pending", "Paid"]),
  transaction: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Transaction is should be a valid transaction"),
  timestamp: z.date().default(() => new Date()),
})

export type IDue = z.infer<typeof SDue>