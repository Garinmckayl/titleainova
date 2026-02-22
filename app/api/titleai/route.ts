import { NextRequest } from 'next/server';
import { lookupCounty } from '@/lib/agents/title-search/property-lookup';
import { retrieveCountyRecords } from '@/lib/agents/title-search/record-retrieval';
import { buildChainOfTitle, detectLiens, assessRisk, generateSummary } from '@/lib/agents/title-search/analysis';
import { generateTitleReportPDF } from '@/lib/title-report-generator';
import { getMockDocs } from '@/lib/agents/title-search/mock';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Try Nova Act browser automation via Python sidecar (nova-act-service/main.py).
 * Falls back gracefully if NOVA_ACT_SERVICE_URL is not set or sidecar is unreachable.
 */
async function tryNovaActSearch(address: string, countyName: string, baseUrl: string) {
  const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;
  if (!sidecarUrl) return null;

  try {
    // Call our own /api/nova-act route which proxies to the Python sidecar
    const res = await fetch(`${baseUrl}/api/nova-act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, county: countyName }),
      signal: AbortSignal.timeout(270000), // 4.5 min — browser automation takes time
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.data;
    }
  } catch {
    // Sidecar unreachable — fall through to web search / mock fallback
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  const encoder = new TextEncoder();

  // Derive base URL for internal API calls (works on both local and Vercel)
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: County Lookup
        send({ type: 'progress', step: 'lookup', message: 'Identifying county and recorder...' });
        let county = await lookupCounty(address);
        
        if (!county) {
          county = { name: 'Unknown County', state: 'US', recorderUrl: '', searchUrl: '' };
          send({ type: 'progress', step: 'lookup', message: 'County not in list. Proceeding with general search...' });
        } else {
          send({ type: 'progress', step: 'lookup', message: `Found property in ${county.name}.` });
        }

        // Step 2: Nova Act Browser Automation (primary) → Web Search (fallback)
        send({ type: 'progress', step: 'retrieval', message: `Launching Nova Act browser agent for ${county.name} recorder...` });

        const novaActData = await tryNovaActSearch(address, county.name, baseUrl);
        let docs: any[] = [];

        if (novaActData) {
          send({ type: 'progress', step: 'retrieval', message: `Nova Act extracted ${novaActData.ownershipChain?.length || 0} deed records from county recorder website.` });
          docs = [{
            source: 'Amazon Nova Act — County Recorder Browser Agent',
            url: county.recorderUrl || '',
            text: JSON.stringify(novaActData),
            type: 'NovaAct',
          }];
        } else {
          send({ type: 'progress', step: 'retrieval', message: `Falling back to web search for ${county.name} records...` });

          const hasTavily = process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.startsWith('your_');
          const hasGoogle = process.env.GOOGLE_SEARCH_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY.startsWith('your_');
          if (!hasTavily && !hasGoogle) {
            send({ type: 'progress', step: 'retrieval', message: 'No search keys found. Using demonstration mode...' });
            docs = getMockDocs(address, county.name);
            await new Promise(r => setTimeout(r, 1000));
          } else {
            docs = await retrieveCountyRecords(address, county.name);
            if (docs.length === 0) {
              send({ type: 'error', message: 'No digital records found. A manual county search may be required.' });
              return;
            }
            send({ type: 'progress', step: 'retrieval', message: `Analyzed ${docs.length} property records.` });
          }
        }

        // Step 3: AI Analysis with Amazon Nova Pro
        send({ type: 'progress', step: 'chain', message: 'Building chain of title with Amazon Nova Pro...' });

        // Use Nova Act structured data directly when available
        let chain = novaActData?.ownershipChain?.length ? novaActData.ownershipChain : await buildChainOfTitle(docs);

        send({ type: 'progress', step: 'liens', message: 'Scanning for active liens...' });
        let liens = novaActData?.liens?.length ? novaActData.liens : await detectLiens(docs, county.name);

        send({ type: 'progress', step: 'risk', message: 'Assessing title risks with Amazon Nova Pro...' });
        const exceptions = await assessRisk(chain, liens);
        const summary = await generateSummary(chain, liens, exceptions);

        // Step 4: PDF Report
        send({ type: 'progress', step: 'summary', message: 'Generating Title Commitment PDF...' });
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
            ? `Amazon Nova Act — County Recorder Browser Agent (${novaActData.source?.includes('error') ? 'Partial' : 'Live'})`
            : 'Web Search + Amazon Nova Pro',
        };

        const pdfBuffer = await generateTitleReportPDF(reportData);
        const pdfBase64 = pdfBuffer.toString('base64');

        send({ type: 'result', data: { ...reportData, pdfBase64 } });
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
