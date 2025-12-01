import { z } from "zod";
import mongoose from "mongoose"

export const STransaction = z.object({
  senderType: z.enum(["Worker", "Owner"]),
  sender: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Sender is should be a valid worker or owner"),
  kiosk: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Kiosk is should be a valid kiosk"),
  customerPhone: z.string().min(11).max(11),
  amount: z.number(),
  fee: z.number().default(5),
  timestamp: z.date().default(() => new Date()),
})

export type ITransaction = z.infer<typeof STransaction>
