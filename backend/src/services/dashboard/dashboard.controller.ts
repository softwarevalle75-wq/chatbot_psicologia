import type { NextFunction, Request, Response } from "express";
import { fetchDashboardSummary } from "./dashboard.service.js";

export async function getDashboardSummaryController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const summary = await fetchDashboardSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
}
