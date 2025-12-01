import { z } from "zod";

export const SUser = z.object({
  phone: z.string().min(11).max(11),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  points: z.number().default(0),
  isVerified: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
})

export type IUser = z.infer<typeof SUser>