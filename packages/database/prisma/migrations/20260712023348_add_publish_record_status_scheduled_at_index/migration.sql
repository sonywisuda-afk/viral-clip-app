-- CreateIndex
CREATE INDEX "PublishRecord_status_scheduledAt_idx" ON "PublishRecord"("status", "scheduledAt");
