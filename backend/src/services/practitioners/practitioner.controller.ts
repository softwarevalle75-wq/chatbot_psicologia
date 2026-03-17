import type { NextFunction, Request, Response } from "express";
import {
  listPractitioners,
  getPractitionerById,
  createPractitioner,
  updatePractitioner,
  deactivatePractitioner,
} from "./practitioner.service.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createPractitionerSchema,
  updatePractitionerSchema,
} from "./practitioner.schema.js";

export const validateCreate = validate(createPractitionerSchema);
export const validateUpdate = validate(updatePractitionerSchema);

export async function getPractitionersController(
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

export async function getPractitionerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const practitioner = await getPractitionerById(req.params.id);
    res.json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function createPractitionerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const practitioner = await createPractitioner(req.body);
    res.status(201).json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function updatePractitionerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const practitioner = await updatePractitioner(req.params.id, req.body);
    res.json(practitioner);
  } catch (error) {
    next(error);
  }
}

export async function deactivatePractitionerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await deactivatePractitioner(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
