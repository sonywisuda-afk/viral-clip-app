import { VideoStatus } from '@speedora/shared';
import {
  formatEngagementScore,
  formatShortDate,
  toBarPercent,
  videoStatusBadge,
} from './analytics';

describe('toBarPercent', () => {
  it('computes a percentage relative to the max', () => {
    expect(toBarPercent(5, 10)).toBe(50);
    expect(toBarPercent(10, 10)).toBe(100);
    expect(toBarPercent(0, 10)).toBe(0);
  });

  it('returns 0 when max is 0 or negative, instead of dividing by zero', () => {
    expect(toBarPercent(5, 0)).toBe(0);
    expect(toBarPercent(5, -1)).toBe(0);
  });

  it('clamps a count larger than max to 100', () => {
    expect(toBarPercent(15, 10)).toBe(100);
  });
});

describe('videoStatusBadge', () => {
  it('maps RENDERED to a good tone', () => {
    expect(videoStatusBadge(VideoStatus.RENDERED)).toEqual({ label: 'Selesai', tone: 'good' });
  });

  it('maps FAILED to a bad tone', () => {
    expect(videoStatusBadge(VideoStatus.FAILED)).toEqual({ label: 'Gagal', tone: 'bad' });
  });

  it('maps in-progress statuses to a neutral tone', () => {
    expect(videoStatusBadge(VideoStatus.IMPORTING).tone).toBe('neutral');
    expect(videoStatusBadge(VideoStatus.UPLOADED).tone).toBe('neutral');
    expect(videoStatusBadge(VideoStatus.TRANSCRIBED).tone).toBe('neutral');
    expect(videoStatusBadge(VideoStatus.CLIPS_DETECTED).tone).toBe('neutral');
  });
});

describe('formatEngagementScore', () => {
  it('formats a score to 2 decimal places', () => {
    expect(formatEngagementScore(0.4213)).toBe('0.42');
    expect(formatEngagementScore(0)).toBe('0.00');
  });

  it('returns a not-available label for null', () => {
    expect(formatEngagementScore(null)).toBe('Belum ada data');
  });
});

describe('formatShortDate', () => {
  it('formats an ISO date as day + short month', () => {
    expect(formatShortDate('2026-01-08')).toBe('8 Jan');
    expect(formatShortDate('2026-07-12')).toBe('12 Jul');
    expect(formatShortDate('2026-12-01')).toBe('1 Des');
  });
});
