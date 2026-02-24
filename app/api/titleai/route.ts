import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { lookupCounty } from '@/lib/agents/title-search/property-lookup';
import { retrieveCountyRecords } from '@/lib/agents/title-search/record-retrieval';
import { runAnalysisPipeline } from '@/lib/agents/title-search/analysis';
import { generateTitleReportPDF } from '@/lib/title-report-generator';
import { getMockDocs } from '@/lib/agents/title-search/mock';
import { saveSearch, createReview, type ScreenshotRecord } from '@/lib/turso';
import { createCitation, computeOverallConfidence } from '@/lib/agents/title-search/provenance';
import { notifyReviewRequested } from '@/lib/notifications';
import type { DataSourceType, SourceCitation } from '@/lib/agents/title-search/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Stream Nova Act browser progress + final data from the Python sidecar via SSE.
 * Captures screenshots into the provided array so they can be persisted to DB.
 */
async function streamNovaActSearch(
  address: string,
  countyName: string,
  send: (data: any) => void,
  collectedScreenshots: ScreenshotRecord[],
): Promise<any | null> {
  const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;
  if (!sidecarUrl) {
    send({ type: 'log', step: 'retrieval', message: 'Nova Act service not configured — using web search fallback.' });
    return null;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${sidecarUrl}/search-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, county: countyName }),
      signal: AbortSignal.timeout(270_000),
    });
  } catch (err: any) {
    send({ type: 'log', step: 'retrieval', message: `Nova Act sidecar unavailable (${err.message}) — using fallback mode.` });
    return null;
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    send({ type: 'log', step: 'retrieval', message: `Sidecar returned HTTP ${upstreamRes.status} — using fallback mode.` });
    return null;
  }

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultData: any = null;

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
        if (evt.type === 'progress') {
          send({ type: 'log', step: evt.step, message: evt.message });
        } else if (evt.type === 'live_view') {
          send({ type: 'live_view', url: evt.url });
        } else if (evt.type === 'screenshot') {
          // Forward to frontend AND collect for DB persistence
          send({ type: 'screenshot', label: evt.label, step: evt.step, data: evt.data });
          collectedScreenshots.push({ label: evt.label, step: evt.step, data: evt.data });
        } else if (evt.type === 'result') {
          resultData = evt.data;
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return resultData;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const { address } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Collect screenshots from the sidecar to save in DB
      const collectedScreenshots: ScreenshotRecord[] = [];

      try {
        // Step 1: County Lookup
        send({ type: 'progress', step: 'lookup', message: 'Identifying county and recorder...' });
        let county = await lookupCounty(address);

        if (!county) {
          county = { name: 'Unknown County', state: 'US', recorderUrl: '', searchUrl: '' };
          send({ type: 'log', step: 'lookup', message: 'County not in database — defaulting to general search.' });
        } else {
          send({ type: 'log', step: 'lookup', message: `Property located in ${county.name}, ${county.state}.` });
        }

        // Step 2: Nova Act SSE streaming (real-time browser logs to UI)
        send({ type: 'progress', step: 'retrieval', message: `Nova Act launching Chromium for ${county.name} recorder...` });

        const novaActData = await streamNovaActSearch(address, county.name, send, collectedScreenshots);
        let docs: any[] = [];
        let sourceType: DataSourceType = 'tavily_search';
        const citations: SourceCitation[] = [];

        if (novaActData) {
          sourceType = 'nova_act';
          send({ type: 'progress', step: 'chain', message: `Nova Act extracted ${novaActData.ownershipChain?.length || 0} deed records from county recorder.` });

          const citation = createCitation('nova_act', `${county.name} Official Records — Nova Act Browser Agent`, county.recorderUrl || '', {
            documentType: 'County Recorder Official Records',
          });
          citations.push(citation);

          docs = [{
            source: 'Amazon Nova Act — County Recorder Browser Agent',
            url: county.recorderUrl || '',
            text: JSON.stringify(novaActData),
            type: 'NovaAct',
            citation,
          }];
        } else {
          send({ type: 'log', step: 'retrieval', message: `Falling back to web search for ${county.name}...` });

          const hasTavily = process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.startsWith('your_');
          const hasGoogle = process.env.GOOGLE_SEARCH_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY.startsWith('your_');
          if (!hasTavily && !hasGoogle) {
            sourceType = 'mock_demo';
            send({ type: 'log', step: 'retrieval', message: 'No search API keys — using demonstration mode.' });
            docs = getMockDocs(address, county.name);
            // Add mock citation
            citations.push(createCitation('mock_demo', 'Demonstration Data', 'http://mock-registry.gov/', {
              excerpt: 'This is simulated data for demonstration purposes only.',
            }));
            await new Promise(r => setTimeout(r, 800));
          } else {
            sourceType = 'tavily_search';
            docs = await retrieveCountyRecords(address, county.name);
            if (docs.length === 0) {
              send({ type: 'error', message: 'No digital records found. A manual courthouse search may be required.' });
              return;
            }
            // Collect citations from docs
            for (const d of docs) {
              if (d.citation) citations.push(d.citation);
            }
            send({ type: 'log', step: 'retrieval', message: `Analyzed ${docs.length} property records from web search.` });
          }
          send({ type: 'progress', step: 'chain', message: 'Building chain of title with Amazon Nova Pro...' });
        }

        // Step 3: Enhanced analysis pipeline with provenance + ALTA
        send({ type: 'progress', step: 'liens', message: 'Scanning for active liens and encumbrances...' });
        send({ type: 'progress', step: 'risk', message: 'Assessing title risks with Amazon Nova Pro...' });

        const analysis = await runAnalysisPipeline(docs, address, county.name, sourceType, {
          parcelId: novaActData?.parcelId,
          legalDescription: novaActData?.legalDescription,
          preExtractedChain: novaActData?.ownershipChain,
          preExtractedLiens: novaActData?.liens,
        });

        // Compute overall confidence
        const overallConfidence = computeOverallConfidence(
          analysis.chain, analysis.liens, analysis.exceptions, sourceType, citations
        );

        // Step 4: PDF Report
        send({ type: 'progress', step: 'summary', message: 'Generating ALTA-compliant Title Commitment PDF...' });
        const reportData = {
          propertyAddress: address,
          county: county.name,
          reportDate: new Date().toLocaleDateString(),
          parcelId: novaActData?.parcelId,
          legalDescription: novaActData?.legalDescription,
          ownershipChain: analysis.chain,
          liens: analysis.liens,
          exceptions: analysis.exceptions,
          summary: analysis.summary,
          sources: citations,
          overallConfidence,
          altaScheduleA: analysis.altaScheduleA,
          altaScheduleB: analysis.altaScheduleB,
          reviewStatus: 'pending_review' as const,
          dataSource: novaActData
            ? `Amazon Nova Act — County Recorder Browser Agent (${novaActData.source?.includes('simulation') ? 'Demo' : 'Live'}) | Confidence: ${overallConfidence.level} (${overallConfidence.score}%)`
            : `Web Search + Amazon Nova Pro | Confidence: ${overallConfidence.level} (${overallConfidence.score}%)`,
        };

        const pdfBuffer = await generateTitleReportPDF(reportData);
        const pdfBase64 = pdfBuffer.toString('base64');

        // Persist search + screenshots to Turso DB
        try {
          const searchId = await saveSearch(
            address,
            county.name,
            novaActData?.parcelId ?? null,
            novaActData?.source ?? 'web_search',
            reportData,
            collectedScreenshots,
            userId,
          );

          // Create a review record for human-in-the-loop
          try {
            await createReview(searchId);
            await notifyReviewRequested(userId, searchId, address);
          } catch (err) {
            console.error('[Review] createReview failed:', err);
          }

          send({ type: 'result', data: { ...reportData, pdfBase64, searchId } });
        } catch (err: any) {
          console.error('[Turso] saveSearch failed:', err);
          // Still send the result even if DB save fails
          send({ type: 'result', data: { ...reportData, pdfBase64, saveError: err.message } });
        }
      } catch (e: any) {
        console.error('Title search error:', e);
        send({ type: 'error', message: e.message || 'An unexpected error occurred.' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
