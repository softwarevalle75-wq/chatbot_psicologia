-- CreateTable
CREATE TABLE "RagConfig" (
    "id" TEXT NOT NULL DEFAULT 'general',
    "systemInstructions" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "metadata" JSONB,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagConfig_pkey" PRIMARY KEY ("id")
);
