import { searchTavily } from '@/lib/tools/tavily';
import { createCitation } from './provenance';
import { SourceCitation, DataSourceType } from './types';

// Helper to fetch text from a URL (simple scraper fallback)
async function fetchWebPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TitleAI/1.0)' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return null;

    const html = await res.text();
    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gmi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

export interface RetrievedDocument {
  source: string;
  url: string;
  text: string;
  type: 'PDF' | 'WebPage' | 'NovaAct';
  /** Source citation for provenance tracking */
  citation?: SourceCitation;
}

/**
 * Retrieve county records via web search with provenance tracking.
 * Returns documents along with their source citations.
 */
export async function retrieveCountyRecords(
  address: string,
  county: string
): Promise<RetrievedDocument[]> {
  const coreAddress = address.replace(/,.*$/, '');

  const queries = [
    `"${address}" ${county} deed filetype:pdf`,
    `${coreAddress} ${county} property records`,
    `${coreAddress} ${county} appraisal district`,
    `"${address}" warranty deed`,
    `${address} real estate title history`,
  ];

  const documents: RetrievedDocument[] = [];
  const visitedUrls = new Set<string>();

  console.log(`[TitleSearch] Starting retrieval for ${address} in ${county}`);

  const searchPromises = queries.map(async (query) => {
    const results: { url: string; title: string; content?: string }[] = [];

    if (process.env.TAVILY_API_KEY) {
      try {
        const tResults = await searchTavily(query);
        results.push(...tResults.map(r => ({ ...r, content: r.content })));
      } catch (e) {
        console.warn(`[TitleSearch] Tavily failed for "${query}":`, e instanceof Error ? e.message : e);
      }
    }

    return results;
  });

  const allResults = (await Promise.all(searchPromises)).flat();

  for (const res of allResults) {
    if (documents.length >= 8) break;
    if (visitedUrls.has(res.url)) continue;
    visitedUrls.add(res.url);

    // Skip PDFs (no OCR available) — use web pages with content
    if (!res.url.toLowerCase().endsWith('.pdf')) {
      const content = res.content || await fetchWebPageText(res.url) || undefined;
      if (content) {
        const sourceType: DataSourceType = 'tavily_search';
        const citation = createCitation(sourceType, res.title, res.url, {
          excerpt: content.slice(0, 500),
          documentType: 'WebPage',
        });

        documents.push({
          source: res.title,
          url: res.url,
          text: content,
          type: 'WebPage',
          citation,
        });
      }
    }
  }

  console.log(`[TitleSearch] Retrieved ${documents.length} documents.`);
  return documents;
}
