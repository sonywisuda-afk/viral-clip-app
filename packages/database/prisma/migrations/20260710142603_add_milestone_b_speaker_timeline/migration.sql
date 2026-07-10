-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "speakerTimeline" JSONB,
ADD COLUMN     "speakerTimelineFeatures" JSONB;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "diarizationFeatures" JSONB;
