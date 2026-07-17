-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('PDF');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "type" "ExportType" NOT NULL DEFAULT 'PDF',
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "resultUrl" TEXT,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportJob_userId_createdAt_idx" ON "ExportJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
