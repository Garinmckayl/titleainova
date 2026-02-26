/**
 * Notification system for Title AI Nova.
 *
 * Supports three channels:
 *   - webhook:  POST to a user-configured URL
 *   - email:    (placeholder — integrate SendGrid/SES in production)
 *   - in_app:   stored in DB for polling by frontend
 *
 * Events:
 *   - job_completed:    background job finished successfully
 *   - job_failed:       background job encountered an error
 *   - review_requested: a report needs human review
 *   - review_completed: a reviewer approved/rejected a report
 */

import {
  getNotificationConfigs,
  logNotification,
} from '@/lib/turso';
import type { NotificationEvent, NotificationConfig } from '@/lib/agents/title-search/types';

interface NotificationPayload {
  event: NotificationEvent;
  /** Search or job ID */
  resourceId: string | number;
  /** Human-readable title */
  title: string;
  /** Detail message */
  message: string;
  /** URL to view the resource */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Send notifications to all configured channels for a user + event combo.
 * Non-blocking — errors are logged but never thrown.
 */
export async function sendNotifications(
  userId: string | null,
  payload: NotificationPayload
): Promise<void> {
  if (!userId) {
    // Still log for anonymous users
    await logNotification(null, payload.event, 'in_app', payload).catch(() => {});
    return;
  }

  let configs: NotificationConfig[] = [];
  try {
    configs = await getNotificationConfigs(userId, payload.event);
  } catch {
    // DB not available — log to console
    console.warn('[Notifications] Could not load configs for user:', userId);
    return;
  }

  // Always send in-app notification
  await logNotification(userId, payload.event, 'in_app', payload).catch(() => {});

  // Send to each configured channel
  const promises = configs.map(async (config) => {
    try {
      switch (config.channel) {
        case 'webhook':
          await sendWebhook(config, payload);
          await logNotification(userId, payload.event, 'webhook', payload, 'sent');
          break;
        case 'email':
          await sendEmail(config, payload);
          await logNotification(userId, payload.event, 'email', payload, 'sent');
          break;
        case 'in_app':
          // Already logged above
          break;
      }
    } catch (err: any) {
      console.error(`[Notifications] Failed to send ${config.channel}:`, err.message);
      await logNotification(userId, payload.event, config.channel, payload, 'failed', err.message).catch(() => {});
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Send a webhook notification via HTTP POST.
 */
async function sendWebhook(
  config: NotificationConfig,
  payload: NotificationPayload
): Promise<void> {
  if (!config.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TitleAI-Nova/1.0',
        'X-TitleAI-Event': payload.event,
      },
      body: JSON.stringify({
        event: payload.event,
        resourceId: payload.resourceId,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        metadata: payload.metadata,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Webhook returned HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send an email notification.
 * This is a placeholder — in production, integrate with SendGrid, AWS SES, or Resend.
 */
async function sendEmail(
  config: NotificationConfig,
  payload: NotificationPayload
): Promise<void> {
  if (!config.email) {
    throw new Error('Email address not configured');
  }

  // Log the intent — actual email sending requires an email service integration
  console.log(`[Notifications] Email queued for ${config.email}: ${payload.title}`);

  // Production integration would look like:
  // await sendgrid.send({
  //   to: config.email,
  //   from: 'notifications@titleai.nova',
  //   subject: payload.title,
  //   text: payload.message,
  //   html: buildEmailTemplate(payload),
  // });
}

// ─── Convenience helpers ────────────────────────────────────────────────────

/** Notify when a background job completes successfully */
export async function notifyJobCompleted(
  userId: string | null,
  jobId: string,
  address: string
): Promise<void> {
  await sendNotifications(userId, {
    event: 'job_completed',
    resourceId: jobId,
    title: `Title search completed: ${address}`,
    message: `Your title search for ${address} has been completed. View the full report to see the chain of title, liens, and risk assessment.`,
    url: `/jobs?id=${jobId}`,
    metadata: { address },
  });
}

/** Notify when a background job fails */
export async function notifyJobFailed(
  userId: string | null,
  jobId: string,
  address: string,
  error: string
): Promise<void> {
  await sendNotifications(userId, {
    event: 'job_failed',
    resourceId: jobId,
    title: `Title search failed: ${address}`,
    message: `Your title search for ${address} encountered an error: ${error}. You may retry the search or contact support.`,
    url: `/jobs?id=${jobId}`,
    metadata: { address, error },
  });
}

/** Notify when a report is ready for review */
export async function notifyReviewRequested(
  userId: string | null,
  searchId: number,
  address: string
): Promise<void> {
  await sendNotifications(userId, {
    event: 'review_requested',
    resourceId: searchId,
    title: `Review requested: ${address}`,
    message: `A title search report for ${address} is awaiting professional review. Please review the findings and approve or reject the report.`,
    url: `/searches?id=${searchId}`,
    metadata: { address },
  });
}

/** Notify when a review decision is made */
export async function notifyReviewCompleted(
  userId: string | null,
  searchId: number,
  address: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  await sendNotifications(userId, {
    event: 'review_completed',
    resourceId: searchId,
    title: `Report ${decision}: ${address}`,
    message: decision === 'approved'
      ? `The title report for ${address} has been approved by a licensed examiner.`
      : `The title report for ${address} has been rejected. See reviewer comments for details.`,
    url: `/searches?id=${searchId}`,
    metadata: { address, decision },
  });
}

/** Notify about job progress milestones */
export async function notifyJobProgress(
  userId: string | null,
  jobId: string,
  address: string,
  step: string,
  progressPct: number
): Promise<void> {
  const stepLabels: Record<string, string> = {
    lookup: 'County identified',
    retrieval: 'Pulling records from county database',
    chain: 'Tracing ownership chain',
    liens: 'Checking for liens and encumbrances',
    risk: 'Assessing title risk',
    summary: 'Building your report',
  };
  const label = stepLabels[step] || step;

  await sendNotifications(userId, {
    event: 'job_progress',
    resourceId: jobId,
    title: `Search in progress: ${address}`,
    message: `${label} (${progressPct}% complete)`,
    url: `/jobs?id=${jobId}`,
    metadata: { address, step, progressPct },
  });
}
