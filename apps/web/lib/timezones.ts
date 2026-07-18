// Phase 6 (Scheduling) - no date/timezone library is a dependency anywhere
// in this repo (see apps/api's next-slot.util.ts, which resolves
// RecurringSchedule slots the same way): Intl already has full IANA data,
// so the frontend's timezone picker doesn't need one either.

export function listIanaTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Environments without full ICU (rare, but Intl.supportedValuesOf is
    // newer than Intl itself) - fall back to a short, still-useful list
    // rather than an empty picker.
    return ['UTC', 'Asia/Jakarta', 'America/New_York', 'Europe/London'];
  }
}

export function guessLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// 0=Sunday..6=Saturday - matches RecurringSchedule.daysOfWeek's convention
// (Date.getUTCDay()) on the backend.
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function dayLabel(day: number): string {
  return DAY_LABELS[day] ?? String(day);
}
