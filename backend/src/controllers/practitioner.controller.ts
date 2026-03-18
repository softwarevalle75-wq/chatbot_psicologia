import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  createPractitioner,
  deletePractitioner,
  getPractitionerById,
  getPractitionerStats,
  listPractitioners,
  listPractitionersPaginated,
  updatePractitioner,
} from "../services/practitioner.service.js";

const createPractitionerSchema = z.object({
  name: z.string().min(2),
  lastName: z.string().optional(),
  email: z.string().email(),
  documentNumber: z.string().min(5),
  documentType: z.string().optional(),
  gender: z.string().optional(),
  eps: z.string().optional(),
  phone: z.string().optional(),
  clinic: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  schedule: z.unknown().optional(),
  active: z.boolean().optional(),
});

const updatePractitionerSchema = z.object({
  name: z.string().min(2).optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  documentNumber: z.string().min(5).optional(),
  documentType: z.string().optional(),
  gender: z.string().optional(),
  eps: z.string().optional(),
  phone: z.string().optional(),
  clinic: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  schedule: z.unknown().optional(),
  active: z.boolean().optional(),
});

export async function getPractitioners(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, search } = req.query;
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const size = pageSize ? parseInt(pageSize as string, 10) : 20;

    if (page || search) {
      const result = await listPractitionersPaginated(pageNum, size, search as string);
      res.json(result);
      return;
    }

    const practitioners = await listPractitioners();
    res.json(practitioners);
  } catch (error) {
    next(error);
  }
}

export async function getPractitioner(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const practitioner = await getPractitionerById(id);
    if (!practitioner) {
      res.status(404).json({ error: "Practicante no encontrado" });
      return;
    }
    res.json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function postPractitioner(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = createPractitionerSchema.parse(req.body);
    const practitioner = await createPractitioner(payload);
    res.status(201).json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function putPractitioner(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const payload = updatePractitionerSchema.parse(req.body);
    const practitioner = await updatePractitioner(id, payload);
    res.json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function removePractitioner(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await deletePractitioner(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getPractitionerStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}
