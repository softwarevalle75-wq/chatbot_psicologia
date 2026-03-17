/**
 * Entry point de la API REST.
 * Los 5 microservicios lógicos se montan aquí como routers de Express.
 * Cada uno tiene su propia carpeta en src/services/<dominio>/.
 */

import "dotenv/config";

// La importación de env DEBE ir primero — valida variables al arranque
// y falla inmediatamente si falta JWT_SECRET, DATABASE_URL u OPENAI_API_KEY
import { env } from "./config/env.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";

// Microservicios lógicos
import authRoutes         from "./services/auth/auth.routes.js";
import patientRoutes      from "./services/patients/patient.routes.js";
import practitionerRoutes from "./services/practitioners/practitioner.routes.js";
import appointmentRoutes  from "./services/appointments/appointment.routes.js";
import dashboardRoutes    from "./services/dashboard/dashboard.routes.js";

// Middlewares globales
import { authGuard }      from "./middlewares/auth.middleware.js";
import { requireRole }    from "./middlewares/requireRole.middleware.js";
import { generalLimiter } from "./middlewares/rateLimit.middleware.js";
import { errorHandler }   from "./middlewares/error.middleware.js";

// ---------------------------------------------------------------------------

const app = express();

// Seguridad HTTP headers
app.use(helmet());

// CORS restringido a orígenes permitidos por .env
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Rate limiting general en todas las rutas
app.use(generalLimiter);

// Parsear JSON — rechaza requests sin Content-Type correcto
app.use(express.json());

// ---------------------------------------------------------------------------
// Rutas por microservicio lógico
// ---------------------------------------------------------------------------

// Auth — público (tiene sus propios rate limiters internos)
app.use("/api/auth", authRoutes);

// Pacientes — solo autenticados
app.use("/api/patients", authGuard, patientRoutes);

// Practicantes — autenticados (GET abierto a admin y practicante, POST/PUT/DELETE solo admin)
app.use("/api/practitioners", authGuard, practitionerRoutes);

// Citas — solo autenticados
app.use("/api/appointments", authGuard, appointmentRoutes);

// Dashboard — solo admin
app.use("/api/dashboard", authGuard, requireRole("admin"), dashboardRoutes);

// ---------------------------------------------------------------------------
// Error handler global (debe ir al final, después de todas las rutas)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------

app.listen(env.API_PORT, () => {
  console.log(`[API] Corriendo en el puerto ${env.API_PORT} — entorno: ${env.NODE_ENV}`);
});
