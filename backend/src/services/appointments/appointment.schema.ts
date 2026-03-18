import { z } from "zod";

export const appointmentDateSchema = z.object({
  date: z.coerce.date().optional(),
});
