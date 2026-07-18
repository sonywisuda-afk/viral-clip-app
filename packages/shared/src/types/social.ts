// Mirrors SocialPlatform in packages/database's Prisma schema. YOUTUBE
// (Fase 6a), TIKTOK (Fase 6d), INSTAGRAM (Fase 6d follow-up), FACEBOOK/
// THREADS (Multi-Platform Publishing Expansion, Phase 1) - see CLAUDE.md's
// "Publish Center" section.
export enum SocialPlatform {
  YOUTUBE = 'YOUTUBE',
  TIKTOK = 'TIKTOK',
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  THREADS = 'THREADS',
  LINKEDIN = 'LINKEDIN',
  PINTEREST = 'PINTEREST',
  X = 'X',
}

// Multi-Platform Publishing Expansion, Phase 0 - the single source of truth
// for platform display metadata, replacing what used to be 3 independently
// hand-copied `PLATFORM_LABELS` maps in apps/web (social/page.tsx,
// DashboardClient.tsx, lib/analytics.ts) with zero icon/color info anywhere.
// `iconKey` is a plain string, not a component - this package has no
// React/lucide-react dependency, so apps/web's lib/platform-metadata.ts maps
// the key to an actual icon. Adding a platform (Phase 1+) means adding one
// enum member here + one entry here, nothing else on the frontend.
export interface PlatformMetadata {
  label: string;
  iconKey: string;
  colorHex: string;
}

export const PLATFORM_METADATA: Record<SocialPlatform, PlatformMetadata> = {
  [SocialPlatform.YOUTUBE]: { label: 'YouTube', iconKey: 'youtube', colorHex: '#FF0000' },
  [SocialPlatform.TIKTOK]: { label: 'TikTok', iconKey: 'tiktok', colorHex: '#000000' },
  [SocialPlatform.INSTAGRAM]: { label: 'Instagram', iconKey: 'instagram', colorHex: '#E1306C' },
  [SocialPlatform.FACEBOOK]: { label: 'Facebook Reels', iconKey: 'facebook', colorHex: '#1877F2' },
  [SocialPlatform.THREADS]: { label: 'Threads', iconKey: 'threads', colorHex: '#000000' },
  [SocialPlatform.LINKEDIN]: { label: 'LinkedIn', iconKey: 'linkedin', colorHex: '#0A66C2' },
  [SocialPlatform.PINTEREST]: { label: 'Pinterest', iconKey: 'pinterest', colorHex: '#E60023' },
  [SocialPlatform.X]: { label: 'X', iconKey: 'x', colorHex: '#000000' },
};

// Publishing Expansion Phase 7A (AI SEO - best-time-to-post heuristic).
// `daysOfWeek` matches RecurringSchedule's own convention (0=Sunday..
// 6=Saturday, Date.getDay()); `hourRangeLocal` is a [startHour, endHour)
// 24h range interpreted in whatever timezone the viewer is looking at it
// in - this is a GENERIC, industry-standard best-practice heuristic, not
// personalized to any workspace's actual audience. Production currently has
// 0 usable per-platform engagement samples (see the Fusion Engine v3
// notes), so a data-driven "when does *this* workspace's audience engage"
// version isn't viable yet - revisit once PublishRecordStatsSnapshot has
// enough real history, same "Open, pending real data" posture as
// @speedora/platform-fit's weights. No LLM/API call needed - static data,
// same convention as PLATFORM_METADATA above.
export interface BestTimeSlot {
  daysOfWeek: number[];
  hourRangeLocal: [number, number];
}

export const BEST_TIME_HEURISTICS: Record<SocialPlatform, BestTimeSlot[]> = {
  [SocialPlatform.YOUTUBE]: [
    { daysOfWeek: [4, 5, 6], hourRangeLocal: [14, 17] }, // Thu-Sat afternoon
  ],
  [SocialPlatform.TIKTOK]: [
    { daysOfWeek: [2, 4], hourRangeLocal: [19, 22] }, // Tue/Thu evening
    { daysOfWeek: [0, 6], hourRangeLocal: [9, 11] }, // weekend morning
  ],
  [SocialPlatform.INSTAGRAM]: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourRangeLocal: [11, 13] }, // weekday lunch
    { daysOfWeek: [1, 2, 3, 4, 5], hourRangeLocal: [19, 21] }, // weekday evening
  ],
  [SocialPlatform.FACEBOOK]: [
    { daysOfWeek: [2, 3, 4], hourRangeLocal: [13, 16] }, // Tue-Thu afternoon
  ],
  [SocialPlatform.THREADS]: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourRangeLocal: [8, 10] }, // weekday morning
  ],
  [SocialPlatform.LINKEDIN]: [
    { daysOfWeek: [2, 3, 4], hourRangeLocal: [9, 11] }, // Tue-Thu mid-morning
  ],
  [SocialPlatform.PINTEREST]: [
    { daysOfWeek: [5, 6, 0], hourRangeLocal: [20, 23] }, // Fri-Sun evening
  ],
  [SocialPlatform.X]: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourRangeLocal: [8, 10] }, // weekday morning commute
    { daysOfWeek: [1, 2, 3, 4, 5], hourRangeLocal: [12, 13] }, // weekday lunch
  ],
};

// API/UI-facing DTO for a connected account - deliberately never includes
// accessToken/refreshToken (see apps/api/src/social/social.service.ts's
// toDto()). Client never needs the tokens themselves; publishing happens
// server-side in apps/worker.
export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  displayName: string;
  tokenExpiresAt: string;
  createdAt: string;
}

// Mirrors PublishStatus in packages/database's Prisma schema. SCHEDULED
// (Fase 6c) is a row waiting for scheduledAt to arrive - the
// schedule-publish-clip poller (apps/worker) claims it into QUEUED once due.
export enum PublishStatus {
  SCHEDULED = 'SCHEDULED',
  QUEUED = 'QUEUED',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

// API/UI-facing shape for one publish attempt of a clip - platform is
// denormalized from the joined SocialAccount so the dashboard doesn't need
// a separate lookup to show e.g. "Published to YouTube".
export interface PublishRecord {
  id: string;
  clipId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  status: PublishStatus;
  // Non-null only for a scheduled publish (Fase 6c) that hasn't fired yet -
  // null means either "publish now" or already past SCHEDULED.
  scheduledAt: string | null;
  // Non-null only once status is PUBLISHED - the platform's own id for the
  // uploaded content (a YouTube video id, or a TikTok publish_id - the
  // latter isn't a public content id/URL, just an acknowledgement that the
  // video was sent to the user's TikTok inbox, see CLAUDE.md's Fase 6d).
  platformPostId: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  // Latest-known snapshot only (Fase 6e) - overwritten on every
  // sync-publish-stats run, not a historical time series. All null until
  // the first sync after publish, and permanently null for TIKTOK (Upload
  // to Inbox mode has no fetchable public video id - see CLAUDE.md's
  // Fase 6e section).
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  statsUpdatedAt: string | null;
  createdAt: string;
  // Publishing Expansion Phase 6 (Scheduling) - both nullable and
  // independent, a job can belong to neither, either, or both. See
  // campaign.ts/recurring-schedule.ts for the two entities these point at.
  campaignId: string | null;
  recurringScheduleId: string | null;
}
