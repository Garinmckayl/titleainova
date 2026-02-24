import { inngest } from '@/lib/inngest';
import { updateJob, saveSearch, createReview, type ScreenshotRecord } from '@/lib/turso';
import { lookupCounty } from '@/lib/agents/title-search/property-lookup';
import { retrieveCountyRecords, type RetrievedDocument } from '@/lib/agents/title-search/record-retrieval';
import { runAnalysisPipeline } from '@/lib/agents/title-search/analysis';
import { generateTitleReportPDF } from '@/lib/title-report-generator';
import { getMockDocs } from '@/lib/agents/title-search/mock';
import { createCitation, computeOverallConfidence } from '@/lib/agents/title-search/provenance';
import { notifyJobCompleted, notifyJobFailed, notifyReviewRequested } from '@/lib/notifications';
import type { DataSourceType, SourceCitation } from '@/lib/agents/title-search/types';

/**
 * Inngest durable function: title-search/run
 *
 * Runs the entire Title AI pipeline as a durable, background job.
 * Each major step is wrapped in `step.run()` for retry + resume.
 * Now includes provenance tracking, ALTA compliance, and notifications.
 */
export const titleSearchJob = inngest.createFunction(
  {
    id: 'title-search-run',
    retries: 2,
  },
  { event: 'titleai/search.requested' },
  async ({ event, step }) => {
    const { jobId, address, userId } = event.data as { jobId: string; address: string; userId?: string };

    // ── Step 1: County Lookup ──────────────────────────────────────
    const county = await step.run('county-lookup', async () => {
      await updateJob(jobId, {
        status: 'running',
        current_step: 'lookup',
        progress_pct: 10,
        log: 'Identifying county and recorder office...',
      });

      const c = await lookupCounty(address);
      const resolved = c ?? { name: 'Unknown County', state: 'US', recorderUrl: '', searchUrl: '' };

      await updateJob(jobId, {
        progress_pct: 20,
        log: `Property located in ${resolved.name}, ${resolved.state}.`,
      });

      return resolved;
    });

    // ── Step 2: Document Retrieval (with screenshot capture) ───────
    const retrieval = await step.run('document-retrieval', async () => {
      await updateJob(jobId, {
        current_step: 'retrieval',
        progress_pct: 30,
        log: `Retrieving records for ${county.name}...`,
      });

      const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;
      let novaActData: any = null;
      const screenshots: ScreenshotRecord[] = [];
      let sourceType: DataSourceType = 'tavily_search';
      const citations: SourceCitation[] = [];

      // Try streaming endpoint to get screenshots
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
                if (evt.type === 'progress') {
                  await updateJob(jobId, { log: evt.message });
                } else if (evt.type === 'screenshot') {
                  screenshots.push({ label: evt.label, step: evt.step, data: evt.data });
                  await updateJob(jobId, {
                    log: `[screenshot] ${evt.label}`,
                    screenshots: [{ label: evt.label, step: evt.step, data: evt.data }],
                  });
                } else if (evt.type === 'result') {
                  novaActData = evt.data;
                }
              } catch { /* skip */ }
            }
          }

          if (novaActData) {
            sourceType = 'nova_act';
            citations.push(createCitation('nova_act', `${county.name} Official Records`, county.recorderUrl || ''));
            await updateJob(jobId, {
              progress_pct: 45,
              log: `Nova Act extracted ${novaActData?.ownershipChain?.length || 0} deed records.`,
            });
          }
        }
      } catch {
        await updateJob(jobId, {
          log: 'Nova Act sidecar unavailable — falling back to web search.',
        });
      }

      if (novaActData) {
        return {
          novaActData,
          screenshots,
          sourceType,
          citations,
          docs: [{
            source: 'Amazon Nova Act — County Recorder Browser Agent',
            url: county.recorderUrl || '',
            text: JSON.stringify(novaActData),
            type: 'NovaAct',
          }],
        };
      }

      // Fallback: web search or mock
      const hasTavily = process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.startsWith('your_');
      let docs: any[];

      if (!hasTavily) {
        sourceType = 'mock_demo';
        await updateJob(jobId, { log: 'No search API keys — using demonstration mode.' });
        docs = getMockDocs(address, county.name);
        citations.push(createCitation('mock_demo', 'Demonstration Data', 'http://mock-registry.gov/'));
      } else {
        sourceType = 'tavily_search';
        docs = await retrieveCountyRecords(address, county.name);
        for (const d of docs) { if (d.citation) citations.push(d.citation); }
        if (docs.length === 0) {
          throw new Error('No digital records found. Manual courthouse search may be required.');
        }
        await updateJob(jobId, {
          progress_pct: 45,
          log: `Analyzed ${docs.length} property records from web search.`,
        });
      }

      return { novaActData: null, screenshots, sourceType, citations, docs };
    });

    // ── Step 3-5: Enhanced Analysis Pipeline ──────────────────────
    const analysis = await step.run('analysis-pipeline', async () => {
      await updateJob(jobId, {
        current_step: 'chain',
        progress_pct: 55,
        log: 'Running analysis pipeline with provenance tracking...',
      });

      return runAnalysisPipeline(
        retrieval.docs as RetrievedDocument[],
        address,
        county.name,
        retrieval.sourceType as DataSourceType,
        {
          parcelId: retrieval.novaActData?.parcelId,
          legalDescription: retrieval.novaActData?.legalDescription,
          preExtractedChain: retrieval.novaActData?.ownershipChain,
          preExtractedLiens: retrieval.novaActData?.liens,
        }
      );
    });

    // ── Step 6: Generate PDF Report ────────────────────────────────
    const result = await step.run('generate-report', async () => {
      await updateJob(jobId, {
        current_step: 'summary',
        progress_pct: 90,
        log: 'Generating ALTA-compliant Title Commitment PDF...',
      });

      const overallConfidence = computeOverallConfidence(
        analysis.chain, analysis.liens, analysis.exceptions,
        retrieval.sourceType as DataSourceType,
        retrieval.citations as SourceCitation[]
      );

      const reportData = {
        propertyAddress: address,
        county: county.name,
        reportDate: new Date().toLocaleDateString(),
        parcelId: retrieval.novaActData?.parcelId,
        legalDescription: retrieval.novaActData?.legalDescription,
        ownershipChain: analysis.chain,
        liens: analysis.liens,
        exceptions: analysis.exceptions,
        summary: analysis.summary,
        sources: retrieval.citations,
        overallConfidence,
        altaScheduleA: analysis.altaScheduleA,
        altaScheduleB: analysis.altaScheduleB,
        reviewStatus: 'pending_review' as const,
        dataSource: retrieval.novaActData
          ? `Amazon Nova Act (${retrieval.novaActData.source?.includes('simulation') ? 'Demo' : 'Live'}) | Confidence: ${overallConfidence.level}`
          : `Web Search + Amazon Nova Pro | Confidence: ${overallConfidence.level}`,
      };

      const pdfBuffer = await generateTitleReportPDF(reportData);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Save to main searches table (with screenshots from retrieval step)
      const allScreenshots: ScreenshotRecord[] = (retrieval.screenshots ?? []) as ScreenshotRecord[];
      const searchId = await saveSearch(
        address,
        county.name,
        retrieval.novaActData?.parcelId ?? null,
        retrieval.novaActData?.source ?? 'web_search',
        reportData,
        allScreenshots,
        userId ?? null,
      ).catch((err) => { console.error('[DB] saveSearch failed:', err); return null; });

      // Create review for human-in-the-loop
      if (searchId) {
        await createReview(searchId).catch(() => {});
        await notifyReviewRequested(userId ?? null, searchId, address);
      }

      return { ...reportData, pdfBase64, searchId };
    });

    // ── Final: Mark job completed + notify ─────────────────────────
    await step.run('mark-completed', async () => {
      await updateJob(jobId, {
        status: 'completed',
        current_step: 'complete',
        progress_pct: 100,
        log: 'Title report generated successfully.',
        result,
      });
      await notifyJobCompleted(userId ?? null, jobId, address);
    });

    return { jobId, status: 'completed' };
  },
);
