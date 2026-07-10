-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "activeSpeakerSamples" JSONB,
ADD COLUMN     "lipSyncVerifications" JSONB,
ADD COLUMN     "speakerFaceAssociations" JSONB;
