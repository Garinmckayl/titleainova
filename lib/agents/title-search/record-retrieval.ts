import { searchTavily } from '@/lib/tools/tavily';
import { extractPdfFromUrl } from '@/lib/tools/textract';
import { createCitation } from './provenance';
import { SourceCitation, DataSourceType } from './types';

/** Fetch text content from a web page (simple HTML scraper) */
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
  /** Structured form fields extracted from PDF (if any) */
  formFields?: Record<string, string>;
  /** Table data extracted from PDF (if any) */
  tables?: string[][];
  /** Number of pages in the PDF (if applicable) */
  pageCount?: number;
}

/**
 * Retrieve county records via web search with Textract PDF processing.
 *
 * Key difference from before: PDFs are now the MOST valuable source.
 * County recorder deeds, liens, tax certs are all PDFs.
 * We use AWS Textract to extract text, form fields, and tables from them.
 */
export async function retrieveCountyRecords(
  address: string,
  county: string
): Promise<RetrievedDocument[]> {
  const coreAddress = address.replace(/,.*$/, '');

  // Search queries targeting both web pages and PDFs
  const queries = [
    `"${address}" ${county} deed filetype:pdf`,
    `${coreAddress} ${county} property records`,
    `${coreAddress} ${county} appraisal district`,
    `"${address}" warranty deed`,
    `${address} real estate title history`,
    `${coreAddress} ${county} deed records pdf`,
    `${coreAddress} ${county} lien records`,
  ];

  const documents: RetrievedDocument[] = [];
  const visitedUrls = new Set<string>();

  console.log(`[TitleSearch] Starting retrieval for ${address} in ${county}`);

  // Run all search queries in parallel
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
  console.log(`[TitleSearch] Got ${allResults.length} raw search results`);

  // Separate PDFs and web pages
  const pdfResults: typeof allResults = [];
  const webResults: typeof allResults = [];

  for (const res of allResults) {
    if (visitedUrls.has(res.url)) continue;
    visitedUrls.add(res.url);

    if (res.url.toLowerCase().endsWith('.pdf') || res.url.toLowerCase().includes('/pdf/')) {
      pdfResults.push(res);
    } else {
      webResults.push(res);
    }
  }

  console.log(`[TitleSearch] Found ${pdfResults.length} PDFs and ${webResults.length} web pages`);

  // Process PDFs with Textract (most valuable data source)
  // Process up to 10 PDFs in parallel (Textract handles concurrency well)
  const pdfBatch = pdfResults.slice(0, 10);
  const pdfPromises = pdfBatch.map(async (res) => {
    try {
      const textractResult = await extractPdfFromUrl(res.url);
      if (!textractResult || textractResult.text.length < 50) return null;

      const citation = createCitation('tavily_search', res.title, res.url, {
        excerpt: textractResult.text.slice(0, 500),
        documentType: 'PDF',
      });

      // Build enriched text that includes form fields and table data
      let enrichedText = textractResult.text;

      if (Object.keys(textractResult.formFields).length > 0) {
        enrichedText += '\n\n--- EXTRACTED FORM FIELDS ---\n';
        for (const [key, value] of Object.entries(textractResult.formFields)) {
          enrichedText += `${key}: ${value}\n`;
        }
      }

      if (textractResult.tables.length > 0) {
        enrichedText += '\n\n--- EXTRACTED TABLES ---\n';
        for (const row of textractResult.tables) {
          enrichedText += row.join(' | ') + '\n';
        }
      }

      const doc: RetrievedDocument = {
        source: res.title,
        url: res.url,
        text: enrichedText,
        type: 'PDF',
        citation,
        formFields: textractResult.formFields,
        tables: textractResult.tables,
        pageCount: textractResult.pageCount,
      };

      return doc;
    } catch (err: any) {
      console.warn(`[TitleSearch] Failed to process PDF ${res.url}: ${err.message}`);
      return null;
    }
  });

  const pdfDocs = (await Promise.all(pdfPromises)).filter(Boolean) as RetrievedDocument[];
  documents.push(...pdfDocs);
  console.log(`[TitleSearch] Extracted ${pdfDocs.length} PDFs via Textract (${pdfDocs.reduce((sum, d) => sum + (d.pageCount || 1), 0)} total pages)`);

  // Process web pages (supplementary data source)
  for (const res of webResults) {
    if (documents.length >= 15) break; // Cap total documents

    const content = res.content || await fetchWebPageText(res.url) || undefined;
    if (content) {
      const citation = createCitation('tavily_search', res.title, res.url, {
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

  console.log(`[TitleSearch] Retrieved ${documents.length} documents total (${pdfDocs.length} PDFs + ${documents.length - pdfDocs.length} web pages).`);
  return documents;
}
