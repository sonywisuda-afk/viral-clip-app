-- CreateTable
CREATE TABLE "ClipVersion" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "outputUrl" TEXT,
    "outputSizeBytes" INTEGER,
    "thumbnailUrl" TEXT,
    "captionStyle" "CaptionStyle" NOT NULL,
    "hookText" TEXT,
    "hashtags" TEXT[],
    "viralityScore" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClipVersion_clipId_versionNumber_idx" ON "ClipVersion"("clipId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClipVersion_clipId_versionNumber_key" ON "ClipVersion"("clipId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ClipVersion" ADD CONSTRAINT "ClipVersion_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipVersion" ADD CONSTRAINT "ClipVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
