-- AlterTable
ALTER TABLE "PublishRecord" ADD COLUMN     "commentCount" INTEGER,
ADD COLUMN     "likeCount" INTEGER,
ADD COLUMN     "statsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER;
