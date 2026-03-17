import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import practitionerRoutes from "./routes/practitioner.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { authGuard } from "./middlewares/auth.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", authGuard, dashboardRoutes);
app.use("/api/patients", authGuard, patientRoutes);
app.use("/api/practitioners", authGuard, practitionerRoutes);
app.use("/api/appointments", authGuard, appointmentRoutes);

app.use(errorHandler);

const PORT = Number(process.env.API_PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
