import mongoose from "mongoose";
import { z } from "zod";

export const SRedemption = z.object({
  requesterType: z.enum(["Customer", "Worker", "Owner"]),
  requester: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "Requester is should be a valid customer, worker or owner"),
  amount: z.number(),
  method: z.enum(["Instapay", "Wallet", "Bank"]),
  details: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
  fee: z.number().default(5),
  timestamp: z.date().default(() => new Date()),
})