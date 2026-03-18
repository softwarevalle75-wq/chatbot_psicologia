-- CreateEnum
CREATE TYPE "PatientState" AS ENUM ('aspirante', 'registrado', 'con_cita', 'activo', 'inactivo');

-- CreateEnum
CREATE TYPE "FlowState" AS ENUM ('register', 'assistantFlow', 'testFlow', 'agendFlow', 'finalFlow');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('programada', 'completada', 'cancelada', 'reagendada');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('nuevo_registro', 'alto_riesgo', 'resultado_test', 'resumen_citas');

-- CreateEnum
CREATE TYPE "MetricOrigin" AS ENUM ('ghq12', 'dass21', 'pdf');

-- CreateEnum
CREATE TYPE "PsychEventType" AS ENUM ('riesgo_suicida', 'ansiedad_severa', 'depresion_critica', 'estres_agudo', 'aislamiento_social');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('bajo', 'medio', 'alto', 'critico');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "name" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'CC',
    "documentNumber" TEXT,
    "state" "PatientState" NOT NULL DEFAULT 'aspirante',
    "flow" "FlowState" NOT NULL DEFAULT 'register',
    "helpStage" INTEGER NOT NULL DEFAULT 1,
    "testActual" TEXT NOT NULL DEFAULT 'ghq12',
    "availability" JSONB NOT NULL DEFAULT '{}',
    "motivo" TEXT,
    "dataAgreement" BOOLEAN NOT NULL DEFAULT false,
    "practitionerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Practitioner" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "documentNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'CC',
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "gender" TEXT NOT NULL,
    "estrato" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Practitioner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultingRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAnalysis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "detectedEmotion" TEXT,
    "stressLevel" INTEGER,
    "anxietyLevel" INTEGER,
    "depressionLevel" INTEGER,
    "riskLevel" "RiskLevel",
    "analysisJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychEvaluation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "responses" JSONB,
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ghq12Result" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "mentalHealth" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,

    CONSTRAINT "Ghq12Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dass12Result" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "depressionScore" INTEGER NOT NULL,
    "anxietyScore" INTEGER NOT NULL,
    "stressScore" INTEGER NOT NULL,
    "depressionLevel" "RiskLevel" NOT NULL,
    "anxietyLevel" "RiskLevel" NOT NULL,
    "stressLevel" "RiskLevel" NOT NULL,

    CONSTRAINT "Dass12Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "consultingRoomId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'programada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfAnalysis" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "summary" TEXT,
    "keywords" TEXT,
    "highlights" TEXT,
    "analysisJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "PsychEventType" NOT NULL,
    "description" TEXT,
    "riskLevel" "RiskLevel" NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychMetric" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "anxiety" INTEGER,
    "depression" INTEGER,
    "stress" INTEGER,
    "risk" "RiskLevel",
    "origin" "MetricOrigin" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "result" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_whatsappNumber_key" ON "Patient"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_documentNumber_key" ON "Patient"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Practitioner_userId_key" ON "Practitioner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Practitioner_documentNumber_key" ON "Practitioner"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAnalysis_sessionId_key" ON "ChatAnalysis"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PsychEvaluation_patientId_type_key" ON "PsychEvaluation"("patientId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Ghq12Result_evaluationId_key" ON "Ghq12Result"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "Dass12Result_evaluationId_key" ON "Dass12Result"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfAnalysis_documentId_key" ON "PdfAnalysis"("documentId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practitioner" ADD CONSTRAINT "Practitioner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAnalysis" ADD CONSTRAINT "ChatAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychEvaluation" ADD CONSTRAINT "PsychEvaluation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ghq12Result" ADD CONSTRAINT "Ghq12Result_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PsychEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dass12Result" ADD CONSTRAINT "Dass12Result_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PsychEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_consultingRoomId_fkey" FOREIGN KEY ("consultingRoomId") REFERENCES "ConsultingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfDocument" ADD CONSTRAINT "PdfDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfAnalysis" ADD CONSTRAINT "PdfAnalysis_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PdfDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychEvent" ADD CONSTRAINT "PsychEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychEvent" ADD CONSTRAINT "PsychEvent_attendedById_fkey" FOREIGN KEY ("attendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychMetric" ADD CONSTRAINT "PsychMetric_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessAudit" ADD CONSTRAINT "AccessAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
