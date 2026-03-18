import type { NextFunction, Request, Response } from "express";
import { listAllPdfDocuments, listPdfDocumentsByPractitioner } from "../pdf.service.js";

function getRequestRole(req: Request) {
  if (typeof req.user === "object" && req.user && "role" in req.user) {
    return String(req.user.role || "").toLowerCase();
  }
  return "";
}

function getRequestProfileId(req: Request) {
  if (typeof req.user === "object" && req.user && "profileId" in req.user) {
    const profileId = req.user.profileId;
    return profileId ? String(profileId) : null;
  }
  return null;
}

export async function getPdfDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getRequestRole(req);

    if (role === "admin") {
      const pdfs = await listAllPdfDocuments();
      return res.json(pdfs);
    }

    if (role === "practicante") {
      const practitionerId = getRequestProfileId(req);
      if (!practitionerId) {
        return res.status(400).json({ message: "No se encontro el practicante de la sesion" });
      }

      const pdfs = await listPdfDocumentsByPractitioner(practitionerId);
      return res.json(pdfs);
    }

    return res.status(403).json({ message: "No autorizado para consultar PDF" });
  } catch (error) {
    next(error);
  }
}
