import { z } from "zod";

export const SOwner = z.object({
  phone: z.string().min(11).max(11),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z ]+$/),
  points: z.number().default(0),
  isApproved: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
})

export type IOwner = z.infer<typeof SOwner>