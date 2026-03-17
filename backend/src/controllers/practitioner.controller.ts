import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { createPractitioner, listPractitioners } from "../services/practitioner.service.js";

const createPractitionerSchema = z.object({
  name: z.string().min(2),
  lastName: z.string().optional(),
  email: z.string().email(),
  documentNumber: z.string().min(5),
  documentType: z.string().optional(),
  gender: z.string().optional(),
  estrato: z.string().optional(),
  barrio: z.string().optional(),
  localidad: z.string().optional(),
  schedule: z.unknown().optional(),
});

export async function getPractitioners(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const practitioners = await listPractitioners();
    res.json(practitioners);
  } catch (error) {
    next(error);
  }
}

export async function postPractitioner(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = createPractitionerSchema.parse(req.body);
    const practitioner = await createPractitioner(payload as any);
    res.status(201).json(practitioner);
  } catch (error) {
    next(error);
  }
}
