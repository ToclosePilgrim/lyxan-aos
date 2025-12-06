-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('MARKETPLACE_INTEGRATION', 'AGENT_RUN');

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL,
    "source" "LogSource" NOT NULL,
    "message" TEXT NOT NULL,
    "integrationId" TEXT,
    "agentRunId" TEXT,
    "details" JSONB,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_logs_integrationId_idx" ON "integration_logs"("integrationId");

-- CreateIndex
CREATE INDEX "integration_logs_agentRunId_idx" ON "integration_logs"("agentRunId");

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "marketplace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
