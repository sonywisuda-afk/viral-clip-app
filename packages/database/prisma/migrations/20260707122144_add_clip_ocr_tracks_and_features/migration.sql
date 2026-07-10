-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "ocrFeatures" JSONB,
ADD COLUMN     "ocrTracks" JSONB;
