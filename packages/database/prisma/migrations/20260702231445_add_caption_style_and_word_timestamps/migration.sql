-- CreateEnum
CREATE TYPE "CaptionStyle" AS ENUM ('DEFAULT', 'KARAOKE', 'BOLD_HIGHLIGHT');

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "captionStyle" "CaptionStyle" NOT NULL DEFAULT 'DEFAULT';

-- AlterTable
ALTER TABLE "TranscriptSegment" ADD COLUMN     "words" JSONB;
