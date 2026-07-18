import { BEST_TIME_HEURISTICS, SocialPlatform } from '@speedora/shared';

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHourRange([start, end]: [number, number]): string {
  const format = (hour: number) => {
    const period = hour < 12 || hour === 24 ? 'AM' : 'PM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}${period}`;
  };
  return `${format(start)}-${format(end)}`;
}

// Publishing Expansion Phase 7A (AI SEO - best-time-to-post heuristic).
// Formats BEST_TIME_HEURISTICS' static, generic slots for display next to
// the platform-fit ranking - not personalized, see that constant's own
// comment in packages/shared/src/types/social.ts.
export function bestTimeLabel(platform: SocialPlatform | string): string {
  const slots = BEST_TIME_HEURISTICS[platform as SocialPlatform];
  if (!slots || slots.length === 0) return '';
  const slot = slots[0];
  const days = slot.daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_ABBREVIATIONS[d])
    .join('/');
  return `${days} ${formatHourRange(slot.hourRangeLocal)}`;
}
