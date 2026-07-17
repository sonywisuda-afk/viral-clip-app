-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExportType" ADD VALUE 'EXCEL';
ALTER TYPE "ExportType" ADD VALUE 'HIGHLIGHT_REPORT';
ALTER TYPE "ExportType" ADD VALUE 'BRAND_REPORT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "brandPrimaryColor" TEXT,
ADD COLUMN     "brandSecondaryColor" TEXT;
