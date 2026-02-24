/**
 * Notification configuration API.
 *
 * Endpoints:
 *   GET    /api/notifications               — List user's notification configs
 *   POST   /api/notifications               — Create a notification config (webhook/email/in_app)
 *   GET    /api/notifications?log=true       — Get notification history
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveNotificationConfig, getNotificationConfigs } from '@/lib/turso';
import type { NotificationChannel, NotificationEvent } from '@/lib/agents/title-search/types';

export const runtime = 'nodejs';

const VALID_CHANNELS: NotificationChannel[] = ['email', 'webhook', 'in_app'];
const VALID_EVENTS: NotificationEvent[] = ['job_completed', 'job_failed', 'review_requested', 'review_completed'];

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
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
