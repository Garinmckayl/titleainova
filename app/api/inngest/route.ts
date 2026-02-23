import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { titleSearchJob } from '@/lib/inngest-functions';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [titleSearchJob],
});
