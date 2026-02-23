import { inngest } from '@/lib/inngest';
import { updateJob, saveSearch, type ScreenshotRecord } from '@/lib/turso';
import { lookupCounty } from '@/lib/agents/title-search/property-lookup';
import { retrieveCountyRecords, type RetrievedDocument } from '@/lib/agents/title-search/record-retrieval';
import {
  buildChainOfTitle,
  detectLiens,
  assessRisk,
  generateSummary,
} from '@/lib/agents/title-search/analysis';
import { generateTitleReportPDF } from '@/lib/title-report-generator';
import { getMockDocs } from '@/lib/agents/title-search/mock';

/**
 * Inngest durable function: title-search/run
 *
 * Runs the entire Title AI pipeline as a durable, background job.
 * Each major step is wrapped in `step.run()` for retry + resume.
 * Uses the streaming sidecar endpoint to capture real Nova Act screenshots.
 */
export const titleSearchJob = inngest.createFunction(
  {
    id: 'title-search-run',
    retries: 2,
  },
  { event: 'titleai/search.requested' },
  async ({ event, step }) => {
    const { jobId, address } = event.data as { jobId: string; address: string };

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

      const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL || 'http://35.166.228.8:8001';
      let novaActData: any = null;
      const screenshots: ScreenshotRecord[] = [];

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
        await updateJob(jobId, { log: 'No search API keys — using demonstration mode.' });
        docs = getMockDocs(address, county.name);
      } else {
        docs = await retrieveCountyRecords(address, county.name);
        if (docs.length === 0) {
          throw new Error('No digital records found. Manual courthouse search may be required.');
        }
        await updateJob(jobId, {
          progress_pct: 45,
          log: `Analyzed ${docs.length} property records from web search.`,
        });
      }

      return { novaActData: null, screenshots, docs };
    });

    // ── Step 3: Chain of Title Analysis ────────────────────────────
    const chain = await step.run('chain-of-title', async () => {
      await updateJob(jobId, {
        current_step: 'chain',
        progress_pct: 55,
        log: 'Building chain of title with Amazon Nova Pro...',
      });

      if (retrieval.novaActData?.ownershipChain?.length) {
        return retrieval.novaActData.ownershipChain;
      }
      return buildChainOfTitle(retrieval.docs as RetrievedDocument[]);
    });

    // ── Step 4: Lien Detection ─────────────────────────────────────
    const liens = await step.run('lien-detection', async () => {
      await updateJob(jobId, {
        current_step: 'liens',
        progress_pct: 65,
        log: 'Scanning for active liens and encumbrances...',
      });

      if (retrieval.novaActData?.liens?.length) {
        return retrieval.novaActData.liens;
      }
      return detectLiens(retrieval.docs as RetrievedDocument[], county.name);
    });

    // ── Step 5: Risk Assessment ────────────────────────────────────
    const { exceptions, summary } = await step.run('risk-assessment', async () => {
      await updateJob(jobId, {
        current_step: 'risk',
        progress_pct: 80,
        log: 'Assessing title risks with Amazon Nova Pro...',
      });

      const exc = await assessRisk(chain, liens);
      const sum = await generateSummary(chain, liens, exc);
      return { exceptions: exc, summary: sum };
    });

    // ── Step 6: Generate PDF Report ────────────────────────────────
    const result = await step.run('generate-report', async () => {
      await updateJob(jobId, {
        current_step: 'summary',
        progress_pct: 90,
        log: 'Generating Title Commitment PDF...',
      });

      const reportData = {
        propertyAddress: address,
        county: county.name,
        reportDate: new Date().toLocaleDateString(),
        parcelId: retrieval.novaActData?.parcelId,
        legalDescription: retrieval.novaActData?.legalDescription,
        ownershipChain: chain,
        liens,
        exceptions,
        summary,
        dataSource: retrieval.novaActData
          ? `Amazon Nova Act (${retrieval.novaActData.source?.includes('simulation') ? 'Demo' : 'Live'})`
          : 'Web Search + Amazon Nova Pro',
      };

      const pdfBuffer = await generateTitleReportPDF(reportData);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Save to main searches table (with screenshots from retrieval step)
      const allScreenshots: ScreenshotRecord[] = (retrieval.screenshots ?? []) as ScreenshotRecord[];
      await saveSearch(
        address,
        county.name,
        retrieval.novaActData?.parcelId ?? null,
        retrieval.novaActData?.source ?? 'web_search',
        reportData,
        allScreenshots,
      ).catch((err) => console.error('[DB] saveSearch failed:', err));

      return { ...reportData, pdfBase64 };
    });

    // ── Final: Mark job completed ──────────────────────────────────
    await step.run('mark-completed', async () => {
      await updateJob(jobId, {
        status: 'completed',
        current_step: 'complete',
        progress_pct: 100,
        log: 'Title report generated successfully.',
        result,
      });
    });

    return { jobId, status: 'completed' };
  },
);
