/**
 * Tests for the notification system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the turso module
vi.mock('@/lib/turso', () => ({
  getNotificationConfigs: vi.fn(),
  logNotification: vi.fn(),
}));

import { sendNotifications } from '@/lib/notifications';
import { getNotificationConfigs, logNotification } from '@/lib/turso';

const mockGetConfigs = vi.mocked(getNotificationConfigs);
const mockLogNotification = vi.mocked(logNotification);

beforeEach(() => {
  vi.clearAllMocks();
  mockLogNotification.mockResolvedValue(undefined);
});

describe('sendNotifications', () => {
  it('logs in-app notification for anonymous users', async () => {
    await sendNotifications(null, {
      event: 'job_completed',
      resourceId: 'job-123',
      title: 'Test',
      message: 'Test message',
    });

    expect(mockLogNotification).toHaveBeenCalledWith(
      null, 'job_completed', 'in_app',
      expect.objectContaining({ event: 'job_completed', title: 'Test' })
    );
  });

  it('sends to all configured channels', async () => {
    mockGetConfigs.mockResolvedValue([
      { userId: 'user1', channel: 'webhook', event: 'job_completed', webhookUrl: 'https://example.com/hook', enabled: true },
    ]);

    // Mock fetch for webhook
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    try {
      await sendNotifications('user1', {
        event: 'job_completed',
        resourceId: 'job-123',
        title: 'Search completed',
        message: 'Your search is done',
      });

      // Should log in-app + attempt webhook
      expect(mockLogNotification).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-TitleAI-Event': 'job_completed',
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles config loading failure gracefully', async () => {
    mockGetConfigs.mockRejectedValue(new Error('DB unavailable'));

    // Should not throw
    await expect(
      sendNotifications('user1', {
        event: 'job_completed',
        resourceId: 'job-123',
        title: 'Test',
        message: 'Test',
      })
    ).resolves.not.toThrow();
  });

  it('handles webhook failure gracefully', async () => {
    mockGetConfigs.mockResolvedValue([
      { userId: 'user1', channel: 'webhook', event: 'job_completed', webhookUrl: 'https://bad.url/hook', enabled: true },
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      await expect(
        sendNotifications('user1', {
          event: 'job_completed',
          resourceId: 'job-123',
          title: 'Test',
          message: 'Test',
        })
      ).resolves.not.toThrow();

      // Should log the failure
      expect(mockLogNotification).toHaveBeenCalledWith(
        'user1', 'job_completed', 'webhook',
        expect.anything(), 'failed', expect.any(String)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
