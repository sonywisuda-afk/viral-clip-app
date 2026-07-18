-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'INVITE_CREATED', 'INVITE_ACCEPTED', 'PROJECT_CREATED', 'PROJECT_DELETED', 'FOLDER_CREATED', 'FOLDER_DELETED', 'VIDEO_MOVED', 'VIDEO_DELETED', 'CLIP_DELETED', 'SHARE_LINK_CREATED', 'SHARE_LINK_REVOKED', 'APPROVAL_DECIDED');

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLogEntry_workspaceId_createdAt_idx" ON "AuditLogEntry"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_workspaceId_action_idx" ON "AuditLogEntry"("workspaceId", "action");

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
