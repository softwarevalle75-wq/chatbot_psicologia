import type { NextFunction, Request, Response } from "express";
import { listPatients, getPatientDetail } from "./patient.service.js";

export async function getPatientsController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const patients = await listPatients();
    res.json(patients);
  } catch (error) {
    next(error);
  }
}

export async function getPatientController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const patient = await getPatientDetail(req.params.patientId);
    res.json(patient);
  } catch (error) {
    next(error);
  }
}
