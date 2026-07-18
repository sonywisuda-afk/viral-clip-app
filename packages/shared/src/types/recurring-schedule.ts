import type { SocialPlatform } from './social';

// Publishing Expansion Phase 6 (Scheduling). Automatic recurring publish
// time *slots* (e.g. "TikTok every Mon/Wed/Fri at 9am Asia/Jakarta") - NOT
// a "repost the same clip on a cadence" mechanism (explicit product
// decision, a different deferred feature). Clips are queued against a
// schedule via the existing POST /clips/:id/publish endpoint
// (recurringScheduleId field) - see apps/api's next-slot.util.ts, which
// assigns each queued clip the next open slot synchronously at queue time.
export interface RecurringScheduleDto {
  id: string;
  workspaceId: string;
  name: string;
  platform: SocialPlatform;
  // Which connected account this schedule publishes to - a workspace/user
  // can have more than one connected account on the same platform, so
  // `platform` alone isn't enough to target a real SocialAccount.
  socialAccountId: string;
  // IANA timezone name (e.g. "Asia/Jakarta").
  timezone: string;
  // 0=Sunday..6=Saturday, matches JS Date.getDay().
  daysOfWeek: number[];
  // "HH:mm", 24h, wall-clock time in `timezone`.
  timeOfDay: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringScheduleListDto {
  recurringSchedules: RecurringScheduleDto[];
}
