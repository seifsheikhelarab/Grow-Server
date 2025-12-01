import { z } from "zod";
import mongoose from "mongoose"

export const SCommission = z.object({
  transaction: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Transaction is should be a valid transaction"),
  beneficiaryType: z.enum(["Worker", "Owner"]),
  beneficiary: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Beneficiary is should be a valid worker or owner"),
  amount: z.number(),
  timestamp: z.date().default(() => new Date()),
})

export type ICommission = z.infer<typeof SCommission>
