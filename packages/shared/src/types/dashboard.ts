// Sprint 1-2 (Dashboard Redesign, Product Experience track). Mirrors
// ActivityEventType in packages/database's Prisma schema - the Dashboard's
// user-facing Activity Timeline, distinct from VideoStatusEvent (an
// internal pipeline audit trail, not exposed to the frontend at all).
export enum ActivityEventType {
  VIDEO_UPLOADED = 'VIDEO_UPLOADED',
  CLIP_GENERATED = 'CLIP_GENERATED',
  CLIP_EXPORTED = 'CLIP_EXPORTED',
  MEMBER_INVITED = 'MEMBER_INVITED',
}

export interface ActivityEventDto {
  id: string;
  type: ActivityEventType;
  videoId: string | null;
  clipId: string | null;
  // Free-form display context (e.g. { title } for a video/clip that may
  // since have been deleted) - see ActivityEvent.metadata's own comment in
  // schema.prisma.
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardActivityDto {
  events: ActivityEventDto[];
}

// Statistics Row. avgProcessingTimeSeconds is null when no video has
// reached a terminal status (RENDERED/FAILED) yet - "no data," not "zero
// seconds." storageUsedBytes sums Video.sourceSizeBytes + Clip.outputSizeBytes
// for this owner only (see schema.prisma's comment on why this is cheap from
// Postgres alone, unlike packages/storage's bucket-wide getBucketUsage()).
export interface DashboardStatsDto {
  totalVideos: number;
  totalClips: number;
  avgProcessingTimeSeconds: number | null;
  storageUsedBytes: number;
  monthlyVideos: number;
  monthlyClips: number;
  // Count of this user's PAID PremiumCredit rows created this calendar
  // month - reuses the existing premium-transcription credit system rather
  // than a new generic quota concept (explicit product decision).
  premiumCreditsThisMonth: number;
}

// Mirrors PendingInviteRole in packages/database's Prisma schema. Captured
// from the Invite Member modal's Role selector and stored for display only
// - no permission check anywhere reads this field (see schema.prisma's
// comment on PendingInvite for the full "why" - explicitly out of scope for
// this pass: no shared access, no workspace switching, no role enforcement).
export enum PendingInviteRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface PendingInviteDto {
  id: string;
  email: string;
  role: PendingInviteRole;
  createdAt: string;
}

export interface SearchVideoResult {
  videoId: string;
  title: string | null;
  createdAt: string;
}

export interface SearchClipResult {
  clipId: string;
  videoId: string;
  hookText: string | null;
  hashtags: string[];
}

// TranscriptSegment is video-scoped only (not tied to any one Clip - a
// clip's transcript is derived by time-range query, see database.md), so a
// transcript match surfaces the video it belongs to, not a clip.
export interface SearchTranscriptResult {
  videoId: string;
  start: number;
  end: number;
  text: string;
}

export interface SearchResultsDto {
  videos: SearchVideoResult[];
  clips: SearchClipResult[];
  transcriptMatches: SearchTranscriptResult[];
}
