import mongoose from "mongoose";
import { z } from "zod";

export const SGoal = z.object({
  user: z.custom<mongoose.Types.ObjectId>(async (val) => {
    return val
  }, "User is should be a valid user"),
  userType: z.enum(["Customer", "Worker", "Owner"]),
  title: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  targetAmount: z.number(),
  currentAmount: z.number(),
  status: z.enum(["Active", "Completed"]),
  timestamp: z.date().default(() => new Date()),
})

export type IGoal = z.infer<typeof SGoal>