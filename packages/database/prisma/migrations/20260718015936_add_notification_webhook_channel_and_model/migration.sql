-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannel" ADD VALUE 'SLACK';
ALTER TYPE "NotificationChannel" ADD VALUE 'DISCORD';
ALTER TYPE "NotificationChannel" ADD VALUE 'WEBHOOK';

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationWebhook_userId_channel_key" ON "NotificationWebhook"("userId", "channel");

-- AddForeignKey
ALTER TABLE "NotificationWebhook" ADD CONSTRAINT "NotificationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
