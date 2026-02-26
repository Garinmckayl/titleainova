/**
 * Notification configuration API.
 *
 * Endpoints:
 *   GET    /api/notifications                    — List user's notification configs
 *   GET    /api/notifications?inbox=true          — Get in-app notification inbox
 *   GET    /api/notifications?unread=true          — Get unread notification count
 *   POST   /api/notifications                    — Create a notification config
 *   DELETE /api/notifications?id=X               — Delete a notification config
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  saveNotificationConfig,
  getNotificationConfigs,
  ensureDefaultNotificationConfigs,
  getInAppNotifications,
  getUnreadNotificationCount,
} from '@/lib/turso';
import type { NotificationChannel, NotificationEvent } from '@/lib/agents/title-search/types';

export const runtime = 'nodejs';

const VALID_CHANNELS: NotificationChannel[] = ['email', 'webhook', 'in_app'];
const VALID_EVENTS: NotificationEvent[] = ['job_completed', 'job_failed', 'review_requested', 'review_completed'];

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  try {
    // Always ensure defaults exist for this user
    await ensureDefaultNotificationConfigs(userId);

    // Return in-app notification inbox
    if (searchParams.get('inbox') === 'true') {
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
      const notifications = await getInAppNotifications(userId, limit);
      return NextResponse.json({ success: true, data: notifications });
    }

    // Return unread count
    if (searchParams.get('unread') === 'true') {
      const since = searchParams.get('since') || undefined;
      const count = await getUnreadNotificationCount(userId, since);
      return NextResponse.json({ success: true, count });
    }

    // Return configs
    const configs = await getNotificationConfigs(userId);
    return NextResponse.json({ success: true, data: configs });
  } catch (err: any) {
    console.error('[/api/notifications GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { channel, event, webhookUrl, email } = body;

    // Validate channel
    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({
        error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`,
      }, { status: 400 });
    }

    // Validate event
    if (!event || !VALID_EVENTS.includes(event)) {
      return NextResponse.json({
        error: `Invalid event. Must be one of: ${VALID_EVENTS.join(', ')}`,
      }, { status: 400 });
    }

    // Validate channel-specific fields
    if (channel === 'webhook' && !webhookUrl) {
      return NextResponse.json({ error: 'webhookUrl is required for webhook channel' }, { status: 400 });
    }
    if (channel === 'email' && !email) {
      return NextResponse.json({ error: 'email is required for email channel' }, { status: 400 });
    }

    // Validate webhook URL format
    if (webhookUrl) {
      try {
        const url = new URL(webhookUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Must be HTTP or HTTPS');
        }
      } catch {
        return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
      }
    }

    const id = await saveNotificationConfig({
      userId,
      channel,
      event,
      webhookUrl,
      email,
      enabled: true,
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error('[/api/notifications POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
