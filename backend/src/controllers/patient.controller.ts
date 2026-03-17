import type { NextFunction, Request, Response } from "express";
import { listPatients, getPatientDetail } from "../services/patient.service.js";

export async function getPatients(_req: Request, res: Response, next: NextFunction) {
  try {
    const patients = await listPatients();
    res.json(patients);
  } catch (error) {
    next(error);
  }
}

export async function getPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await getPatientDetail(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }
    res.json(patient);
  } catch (error) {
    next(error);
  }
}
