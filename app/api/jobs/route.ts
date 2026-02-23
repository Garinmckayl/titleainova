import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { inngest } from '@/lib/inngest';
import { createJob, getJob, getRecentJobs } from '@/lib/turso';

export const runtime = 'nodejs';

/**
 * POST /api/jobs  — Start a new durable title search job
 * GET  /api/jobs  — List recent jobs
 * GET  /api/jobs?id=<id> — Get single job status + result
 */
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const jobId = nanoid(12);

    // Create the job row in DB
    await createJob(jobId, address.trim());

    // Send the event to Inngest — this triggers the durable function
    await inngest.send({
      name: 'titleai/search.requested',
      data: { jobId, address: address.trim() },
    });

    return NextResponse.json({ success: true, jobId });
  } catch (err: any) {
    console.error('[/api/jobs POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to create job' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const job = await getJob(id);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: job });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const jobs = await getRecentJobs(limit);
    return NextResponse.json({ success: true, data: jobs });
  } catch (err: any) {
    console.error('[/api/jobs GET]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
