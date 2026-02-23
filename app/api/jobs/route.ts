import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { inngest } from '@/lib/inngest';
import { createJob, getJob, getRecentJobs, updateJob, type ScreenshotRecord } from '@/lib/turso';
import { lookupCounty } from '@/lib/agents/title-search/property-lookup';
import { retrieveCountyRecords } from '@/lib/agents/title-search/record-retrieval';
import { buildChainOfTitle, detectLiens, assessRisk, generateSummary } from '@/lib/agents/title-search/analysis';
import { generateTitleReportPDF } from '@/lib/title-report-generator';
import { getMockDocs } from '@/lib/agents/title-search/mock';
import { saveSearch } from '@/lib/turso';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Run title search directly (no Inngest) as a background async task.
 * Used when Inngest is not configured.
 */
async function runDirectSearch(jobId: string, address: string) {
  try {
    // Step 1: County lookup
    await updateJob(jobId, { status: 'running', current_step: 'lookup', progress_pct: 10, log: 'Identifying county and recorder office...' });
    const c = await lookupCounty(address);
    const county = c ?? { name: 'Unknown County', state: 'US', recorderUrl: '', searchUrl: '' };
    await updateJob(jobId, { progress_pct: 20, log: `Property located in ${county.name}, ${county.state}.` });

    // Step 2: Retrieval
    await updateJob(jobId, { current_step: 'retrieval', progress_pct: 30, log: `Retrieving records for ${county.name}...` });
    const screenshots: ScreenshotRecord[] = [];
    let novaActData: any = null;
    const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL || 'http://35.166.228.8:8001';

    try {
      const res = await fetch(`${sidecarUrl}/search-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, county: county.name }),
        signal: AbortSignal.timeout(240_000),
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'progress') await updateJob(jobId, { log: evt.message });
              else if (evt.type === 'screenshot') {
                screenshots.push({ label: evt.label, step: evt.step, data: evt.data });
                await updateJob(jobId, { log: `[screenshot] ${evt.label}`, screenshots: [{ label: evt.label, step: evt.step, data: evt.data }] });
              } else if (evt.type === 'result') novaActData = evt.data;
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      await updateJob(jobId, { log: 'Nova Act sidecar unavailable — falling back.' });
    }

    let docs: any[] = [];
    if (novaActData) {
      await updateJob(jobId, { progress_pct: 45, log: `Nova Act extracted ${novaActData?.ownershipChain?.length || 0} deed records.` });
      docs = [{ source: 'Nova Act', url: county.recorderUrl || '', text: JSON.stringify(novaActData), type: 'NovaAct' }];
    } else {
      const hasTavily = process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.startsWith('your_');
      if (!hasTavily) {
        await updateJob(jobId, { log: 'No search API keys — using demonstration mode.' });
        docs = getMockDocs(address, county.name);
      } else {
        docs = await retrieveCountyRecords(address, county.name);
        await updateJob(jobId, { progress_pct: 45, log: `Analyzed ${docs.length} records from web search.` });
      }
    }

    // Step 3: Chain
    await updateJob(jobId, { current_step: 'chain', progress_pct: 55, log: 'Building chain of title with Amazon Nova Pro...' });
    const chain = novaActData?.ownershipChain?.length ? novaActData.ownershipChain : await buildChainOfTitle(docs);

    // Step 4: Liens
    await updateJob(jobId, { current_step: 'liens', progress_pct: 65, log: 'Scanning for active liens and encumbrances...' });
    const liens = novaActData?.liens?.length ? novaActData.liens : await detectLiens(docs, county.name);

    // Step 5: Risk
    await updateJob(jobId, { current_step: 'risk', progress_pct: 80, log: 'Assessing title risks with Amazon Nova Pro...' });
    const exceptions = await assessRisk(chain, liens);
    const summary = await generateSummary(chain, liens, exceptions);

    // Step 6: Report
    await updateJob(jobId, { current_step: 'summary', progress_pct: 90, log: 'Generating Title Commitment PDF...' });
    const reportData = {
      propertyAddress: address,
      county: county.name,
      reportDate: new Date().toLocaleDateString(),
      parcelId: novaActData?.parcelId,
      legalDescription: novaActData?.legalDescription,
      ownershipChain: chain,
      liens,
      exceptions,
      summary,
      dataSource: novaActData
        ? `Amazon Nova Act (${novaActData.source?.includes('simulation') ? 'Demo' : 'Live'})`
        : 'Web Search + Amazon Nova Pro',
    };
    const pdfBuffer = await generateTitleReportPDF(reportData);
    const pdfBase64 = pdfBuffer.toString('base64');

    await saveSearch(address, county.name, novaActData?.parcelId ?? null, novaActData?.source ?? 'web_search', reportData, screenshots).catch(() => {});

    await updateJob(jobId, {
      status: 'completed',
      current_step: 'complete',
      progress_pct: 100,
      log: 'Title report generated successfully.',
      result: { ...reportData, pdfBase64 },
    });
  } catch (err: any) {
    await updateJob(jobId, { status: 'failed', error: err.message || 'Unknown error', log: `ERROR: ${err.message}` }).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const jobId = nanoid(12);
    await createJob(jobId, address.trim());

    // Try Inngest first; if not configured, run directly
    const hasInngest = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY;
    if (hasInngest) {
      try {
        await inngest.send({
          name: 'titleai/search.requested',
          data: { jobId, address: address.trim() },
        });
      } catch (err: any) {
        console.error('[Inngest send failed, running directly]', err.message);
        // Fire-and-forget direct execution
        runDirectSearch(jobId, address.trim());
      }
    } else {
      // No Inngest configured — run the search directly (non-blocking)
      runDirectSearch(jobId, address.trim());
    }

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
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
