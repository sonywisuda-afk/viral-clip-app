/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { NotificationType, type NotificationDto } from '@speedora/shared';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import { NotificationBell } from './NotificationBell';

// NotificationBell's SWR keys are static strings ('notifications-list',
// 'notifications-unread-count'), not per-test-unique like ExportTypeRow's
// jobId-keyed hook - a fresh cache provider per render is needed so one
// test's cached response can't leak into the next.
function renderBell() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <NotificationBell />
    </SWRConfig>,
  );
}

jest.mock('@/lib/api', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

const mockGetNotifications = getNotifications as jest.Mock;
const mockGetUnreadNotificationCount = getUnreadNotificationCount as jest.Mock;
const mockMarkNotificationRead = markNotificationRead as jest.Mock;
const mockMarkAllNotificationsRead = markAllNotificationsRead as jest.Mock;

function notification(overrides: Partial<NotificationDto>): NotificationDto {
  return {
    id: 'notif-1',
    type: NotificationType.UPLOAD_COMPLETE,
    title: 'Upload selesai',
    body: 'Video "My Video" berhasil diunggah dan sedang diproses.',
    videoId: 'video-1',
    clipId: null,
    metadata: null,
    readAt: null,
    createdAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnreadNotificationCount.mockResolvedValue({ count: 0 });
    mockGetNotifications.mockResolvedValue({ notifications: [] });
    mockMarkNotificationRead.mockResolvedValue(undefined);
    mockMarkAllNotificationsRead.mockResolvedValue({ count: 0 });
  });

  it('renders the unread count badge', async () => {
    mockGetUnreadNotificationCount.mockResolvedValue({ count: 3 });

    renderBell();

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('renders no badge when there are no unread notifications', async () => {
    renderBell();

    await waitFor(() => expect(mockGetUnreadNotificationCount).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows an empty state when the dialog is opened with no notifications', async () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));

    expect(await screen.findByText('Belum ada notifikasi.')).toBeInTheDocument();
  });

  it('renders the notification list with title/body once fetched', async () => {
    mockGetNotifications.mockResolvedValue({
      notifications: [notification({ id: 'notif-1', title: 'Upload selesai' })],
    });

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));

    expect(await screen.findByText('Upload selesai')).toBeInTheDocument();
    expect(
      screen.getByText('Video "My Video" berhasil diunggah dan sedang diproses.'),
    ).toBeInTheDocument();
  });

  it('clicking an unread notification marks it read', async () => {
    mockGetNotifications.mockResolvedValue({
      notifications: [notification({ id: 'notif-1', title: 'Upload selesai', readAt: null })],
    });

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));
    fireEvent.click(await screen.findByText('Upload selesai'));

    await waitFor(() => expect(mockMarkNotificationRead).toHaveBeenCalledWith('notif-1'));
  });

  it('"Tandai semua dibaca" calls the bulk mark-read endpoint', async () => {
    mockGetNotifications.mockResolvedValue({
      notifications: [notification({ id: 'notif-1', readAt: null })],
    });

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tandai semua dibaca' }));

    await waitFor(() => expect(mockMarkAllNotificationsRead).toHaveBeenCalled());
  });
});
