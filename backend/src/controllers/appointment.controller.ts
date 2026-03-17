import type { NextFunction, Request, Response } from "express";
import { listAppointmentsByDate } from "../services/appointment.service.js";

export async function getAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const dateQuery = req.query.date;
    const dateParam = typeof dateQuery === "string" ? new Date(dateQuery) : new Date();
    const appointments = await listAppointmentsByDate(dateParam);
    res.json(appointments);
  } catch (error) {
    next(error);
  }
}
