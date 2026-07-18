import type { Notification } from '@speedora/database';
import {
  formatDiscordPayload,
  formatGenericWebhookPayload,
  formatSlackPayload,
} from './payload-formatters';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'CLIP_READY' as never,
    title: 'Klip siap!',
    body: 'Klip Anda sudah siap ditonton.',
    videoId: 'video-1',
    clipId: 'clip-1',
    metadata: { foo: 'bar' },
    readAt: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

describe('formatSlackPayload', () => {
  it('formats title bold and body plain, Slack incoming-webhook shape', () => {
    const result = formatSlackPayload(notification());
    expect(result).toEqual({ text: '*Klip siap!*\nKlip Anda sudah siap ditonton.' });
  });
});

describe('formatDiscordPayload', () => {
  it('formats title bold and body plain, Discord webhook shape', () => {
    const result = formatDiscordPayload(notification());
    expect(result).toEqual({ content: '**Klip siap!**\nKlip Anda sudah siap ditonton.' });
  });
});

describe('formatGenericWebhookPayload', () => {
  it('mirrors NotificationDto as raw structured JSON', () => {
    const result = formatGenericWebhookPayload(notification());
    expect(result).toEqual({
      type: 'CLIP_READY',
      title: 'Klip siap!',
      body: 'Klip Anda sudah siap ditonton.',
      videoId: 'video-1',
      clipId: 'clip-1',
      metadata: { foo: 'bar' },
      createdAt: '2026-07-18T00:00:00.000Z',
    });
  });

  it('passes through null videoId/clipId/metadata as-is', () => {
    const result = formatGenericWebhookPayload(
      notification({ videoId: null, clipId: null, metadata: null }),
    );
    expect(result.videoId).toBeNull();
    expect(result.clipId).toBeNull();
    expect(result.metadata).toBeNull();
  });
});
