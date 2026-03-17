import { Router } from "express";
import { getPdfDocuments } from "../controllers/pdf.controller.js";

const router = Router();

router.get("/", getPdfDocuments);

export default router;
