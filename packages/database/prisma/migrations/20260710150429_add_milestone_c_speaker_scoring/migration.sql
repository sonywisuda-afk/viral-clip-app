-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "speakerConfidenceScores" JSONB,
ADD COLUMN     "speakerEngagementScores" JSONB,
ADD COLUMN     "speakerHighlightMoments" JSONB,
ADD COLUMN     "speakerImportanceScores" JSONB;
