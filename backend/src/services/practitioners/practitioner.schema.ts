import { z } from "zod";
import { nameSchema, emailSchema, documentSchema, phoneSchema } from "../../utils/validators.js";

export const createPractitionerSchema = z.object({
  name: nameSchema,
  lastName: nameSchema.optional(),
  email: emailSchema,
  documentNumber: documentSchema(),
  documentType: z.enum(["CC", "TI", "CE", "RC", "PE"]).default("CC"),
  gender: z.string().min(1, "El género es requerido").max(40),
  estrato: z.string().min(1).max(20),
  barrio: z.string().min(1).max(80),
  localidad: z.string().min(1).max(80),
  phone: phoneSchema.optional(),
  schedule: z.record(z.unknown()).optional(),
});

export const updatePractitionerSchema = createPractitionerSchema
  .omit({ documentNumber: true, documentType: true, email: true })
  .partial();

export const practitionerIdSchema = z.object({
  id: z.string().uuid("ID de practicante inválido"),
});

export type CreatePractitionerDto = z.infer<typeof createPractitionerSchema>;
export type UpdatePractitionerDto = z.infer<typeof updatePractitionerSchema>;
