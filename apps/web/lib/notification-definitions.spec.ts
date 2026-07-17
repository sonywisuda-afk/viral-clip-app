import { NotificationType } from '@speedora/shared';
import { NOTIFICATION_ICONS, notificationTone } from './notification-definitions';

describe('NOTIFICATION_ICONS', () => {
  it('has an icon for every notification type', () => {
    for (const type of Object.values(NotificationType)) {
      expect(NOTIFICATION_ICONS[type]).toBeDefined();
    }
  });
});

describe('notificationTone', () => {
  it('maps success types to good and RENDER_FAILED to bad', () => {
    expect(notificationTone(NotificationType.UPLOAD_COMPLETE)).toBe('good');
    expect(notificationTone(NotificationType.CLIP_READY)).toBe('good');
    expect(notificationTone(NotificationType.EXPORT_READY)).toBe('good');
    expect(notificationTone(NotificationType.RENDER_FAILED)).toBe('bad');
  });
});
