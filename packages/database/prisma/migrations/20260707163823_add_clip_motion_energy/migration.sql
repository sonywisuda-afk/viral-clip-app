-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "motionEnergy" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "motionEnergyFeatures" JSONB;
