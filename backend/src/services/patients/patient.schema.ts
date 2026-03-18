import { z } from "zod";

export const patientIdSchema = z.object({
  patientId: z.string().uuid("ID de paciente inválido"),
});
