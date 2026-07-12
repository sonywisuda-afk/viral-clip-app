-- CreateEnum
CREATE TYPE "NodeExecutionStatus" AS ENUM ('SUCCESS', 'FALLBACK', 'FAILED');

-- CreateTable
CREATE TABLE "JobExecution" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "graphVersion" TEXT NOT NULL,
    "workerVersion" TEXT,
    "gitCommit" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "totalDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeExecution" (
    "id" TEXT NOT NULL,
    "jobExecutionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "NodeExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "NodeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobExecution_clipId_idx" ON "JobExecution"("clipId");

-- CreateIndex
CREATE INDEX "NodeExecution_nodeId_startedAt_idx" ON "NodeExecution"("nodeId", "startedAt");

-- CreateIndex
CREATE INDEX "NodeExecution_jobExecutionId_idx" ON "NodeExecution"("jobExecutionId");

-- AddForeignKey
ALTER TABLE "JobExecution" ADD CONSTRAINT "JobExecution_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeExecution" ADD CONSTRAINT "NodeExecution_jobExecutionId_fkey" FOREIGN KEY ("jobExecutionId") REFERENCES "JobExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
