-- Milestone 04f: closes out the Notification Center roadmap's last deferred
-- notification type. Fires to the inviter when someone accepts their
-- workspace invite (see WorkspaceService.acceptInvite).
ALTER TYPE "NotificationType" ADD VALUE 'MEMBER_INVITATION_ACCEPTED';
