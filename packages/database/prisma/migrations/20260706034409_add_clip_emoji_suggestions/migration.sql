-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "emojiSuggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
