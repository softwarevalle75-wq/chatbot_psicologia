import type { NextFunction, Request, Response } from "express";
import { listPractitioners } from "../services/practitioner.service.js";

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
