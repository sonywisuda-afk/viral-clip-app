-- CreateTable
CREATE TABLE "PublishRecordStatsSnapshot" (
    "id" TEXT NOT NULL,
    "publishRecordId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "shareCount" INTEGER,
    "watchTimeSeconds" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,

    CONSTRAINT "PublishRecordStatsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishRecordStatsSnapshot_publishRecordId_capturedAt_idx" ON "PublishRecordStatsSnapshot"("publishRecordId", "capturedAt");

-- AddForeignKey
ALTER TABLE "PublishRecordStatsSnapshot" ADD CONSTRAINT "PublishRecordStatsSnapshot_publishRecordId_fkey" FOREIGN KEY ("publishRecordId") REFERENCES "PublishRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
