import { searchLLMLayer, scrapePage } from '@/lib/tools/llmlayer';
import { extractPdfFromUrl } from '@/lib/tools/textract';
import { createCitation } from './provenance';
import { SourceCitation, DataSourceType } from './types';

// ─── County Tax Office Direct Query ──────────────────────────────────────────
// Many TX counties use go2gov.net, which has a predictable URL for address search.
// The search results page returns owner name, account number, and tax status in HTML.

interface CountyTaxConfig {
  /** go2gov.net subdomain prefix, e.g. "webb" → webb.go2gov.net */
  go2govPrefix: string;
  countyName: string;
}

const COUNTY_TAX_CONFIGS: Record<string, CountyTaxConfig> = {
  'Webb County': { go2govPrefix: 'webb', countyName: 'Webb County' },
  // Additional TX counties on go2gov can be added here as discovered
};

/**
 * Parse a US address into street number and street name.
 */
function parseStreetAddress(address: string): { streetNumber: string; streetName: string } | null {
  const street = address.replace(/,.*$/, '').trim();
  const match = street.match(/^(\d+)\s+(.+?)(?:\s+(?:Dr|Drive|St|Street|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Ct|Court|Rd|Road|Way|Pl|Place|Cir|Circle|Trl|Trail|Loop|Pkwy|Parkway)\.?\s*)?$/i);
  if (match) {
    // Return the full street name including suffix for exact matching
    const fullName = street.replace(/^\d+\s+/, '');
    // Extract just the name portion (before the street type suffix)
    const nameOnly = match[2];
    return { streetNumber: match[1], streetName: nameOnly };
  }
  // Simple fallback: first token is number, rest is name
  const parts = street.split(/\s+/);
  if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    return { streetNumber: parts[0], streetName: parts.slice(1).join(' ') };
  }
  return null;
}

/**
 * Query a county tax office directly via go2gov.net URL structure.
 * Returns scraped markdown with owner name, account number, tax due, etc.
 */
async function queryCountyTaxOffice(
  address: string,
  county: string
): Promise<RetrievedDocument | null> {
  const config = COUNTY_TAX_CONFIGS[county];
  if (!config) return null;

  const parsed = parseStreetAddress(address);
  if (!parsed) {
    console.log(`[TitleSearch] Could not parse address for tax lookup: ${address}`);
    return null;
  }

  const { streetNumber, streetName } = parsed;
  // Construct the go2gov.net search URL
  const searchUrl = `https://${config.go2govPrefix}.go2gov.net/${config.go2govPrefix}/cart/search/display.do?` +
    `criteria.searchType=2&criteria.searchStatus=1&pager.pageSize=10&pager.pageNumber=1` +
    `&criteria.streetNumber=${encodeURIComponent(streetNumber)}` +
    `&criteria.streetName=${encodeURIComponent(streetName)}` +
    `&criteria.streetType=`;

  console.log(`[TitleSearch] Querying ${county} Tax Office: ${searchUrl}`);

  try {
    const content = await scrapePage(searchUrl);
    if (!content || content.length < 100) {
      console.log(`[TitleSearch] ${county} Tax Office returned empty content`);
      return null;
    }

    // Check if results were found (look for owner name pattern)
    if (content.includes('0 of 0') || content.includes('No records found')) {
      console.log(`[TitleSearch] ${county} Tax Office: no records found for ${address}`);
      return null;
    }

    const citation = createCitation('county_records', `${county} Tax Office Records`, searchUrl, {
      excerpt: content.slice(0, 500),
      documentType: 'CountyTaxRecord',
    });

    console.log(`[TitleSearch] ${county} Tax Office returned ${content.length} chars of data`);
    return {
      source: `${county} Tax Office - Property Records`,
      url: searchUrl,
      text: `--- ${county.toUpperCase()} TAX OFFICE PROPERTY RECORD ---\n` +
        `Search Address: ${address}\n\n` + content,
      type: 'WebPage',
      citation,
    };
  } catch (err: any) {
    console.warn(`[TitleSearch] ${county} Tax Office query failed: ${err.message}`);
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
 * Retrieve county records via LLMLayer web search + Textract PDF processing.
 *
 * Searches for property records using targeted queries,
 * downloads and processes any PDFs found via AWS Textract,
 * and scrapes web pages for supplementary data.
 */
export async function retrieveCountyRecords(
  address: string,
  county: string
): Promise<RetrievedDocument[]> {
  const coreAddress = address.replace(/,.*$/, '');

  // Targeted search queries for property records
  const queries = [
    `"${address}" ${county} deed records`,
    `${coreAddress} ${county} property records owner`,
    `${coreAddress} ${county} appraisal district property`,
    `"${address}" warranty deed`,
    `${coreAddress} ${county} deed records pdf`,
    `${coreAddress} ${county} lien records`,
    `${coreAddress} property tax ${county}`,
    `"${coreAddress}" property owner name tax assessment`,
  ];

  const documents: RetrievedDocument[] = [];
  const visitedUrls = new Set<string>();

  console.log(`[TitleSearch] Starting LLMLayer retrieval for ${address} in ${county}`);

  // Step 0: Query county tax office directly (highest priority — returns owner name)
  const taxRecordPromise = queryCountyTaxOffice(address, county);

  // Run all search queries in parallel
  const searchPromises = queries.map(async (query) => {
    try {
      const results = await searchLLMLayer(query);
      return results.map(r => ({ url: r.link, title: r.title, content: r.content }));
    } catch (e) {
      console.warn(`[TitleSearch] LLMLayer search failed for "${query}":`, e instanceof Error ? e.message : e);
      return [];
    }
  });

  const allResults = (await Promise.all(searchPromises)).flat();
  console.log(`[TitleSearch] Got ${allResults.length} raw search results from LLMLayer`);

  // Collect county tax office result (highest priority — has owner name)
  const taxRecord = await taxRecordPromise;
  if (taxRecord) {
    documents.push(taxRecord);
    console.log(`[TitleSearch] County tax office returned owner data`);
  }

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
  const pdfBatch = pdfResults.slice(0, 10);
  const pdfPromises = pdfBatch.map(async (res) => {
    try {
      const textractResult = await extractPdfFromUrl(res.url);
      if (!textractResult || textractResult.text.length < 50) return null;

      const citation = createCitation('web_scrape', res.title, res.url, {
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

  // Process web pages — use LLMLayer scraper for rich content extraction
  // Scrape top results in parallel (up to 5 at a time) for real property data
  const scrapeTargets = webResults.slice(0, 8).filter(res => {
    // Prioritize property data sites
    const url = res.url.toLowerCase();
    return url.includes('zillow') || url.includes('trulia') || url.includes('redfin') ||
           url.includes('realtor.com') || url.includes('movoto') || url.includes('county') ||
           url.includes('appraisal') || url.includes('tax') || url.includes('property') ||
           url.includes('deed') || url.includes('recorder') || url.includes('publicsearch');
  });

  // Also include any other results if we don't have enough property sites
  if (scrapeTargets.length < 5) {
    for (const res of webResults) {
      if (scrapeTargets.length >= 5) break;
      if (!scrapeTargets.find(t => t.url === res.url)) {
        scrapeTargets.push(res);
      }
    }
  }

  console.log(`[TitleSearch] Scraping ${scrapeTargets.length} web pages for property data...`);

  const scrapePromises = scrapeTargets.map(async (res) => {
    if (documents.length >= 15) return null;

    try {
      // Use LLMLayer scraper for rich content extraction
      const content = await scrapePage(res.url);
      if (!content || content.length < 50) return null;

      const citation = createCitation('web_scrape', res.title, res.url, {
        excerpt: content.slice(0, 500),
        documentType: 'WebPage',
      });

      return {
        source: res.title,
        url: res.url,
        text: content,
        type: 'WebPage' as const,
        citation,
      };
    } catch {
      return null;
    }
  });

  const scrapedDocs = (await Promise.all(scrapePromises)).filter(Boolean) as RetrievedDocument[];
  documents.push(...scrapedDocs);

  console.log(`[TitleSearch] Retrieved ${documents.length} documents total (${pdfDocs.length} PDFs + ${scrapedDocs.length} scraped pages).`);
  return documents;
}
