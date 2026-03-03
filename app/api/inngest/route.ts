import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { titleSearchJob } from '@/lib/inngest-functions';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [titleSearchJob],
  /**
   * To sync with Inngest Cloud:
   * 1. Set INNGEST_SIGNING_KEY in your environment
   * 2. Deploy your app
   * 3. In Inngest dashboard: Apps → Sync New App → enter:
   *    https://your-app.vercel.app/api/inngest
   *
   * The GET handler returns function metadata for sync.
   * The PUT handler is called by Inngest Cloud to register functions.
   * The POST handler is called to execute functions.
   */
});
