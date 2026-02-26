/**
 * LLMLayer Web Search + Scraper API client.
 * Replaces Tavily as the web search provider.
 * Docs: https://docs.llmlayer.ai/web-search
 */

export interface LLMLayerResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  content?: string;
  url: string; // alias for link, for compatibility with existing code
}

export async function searchLLMLayer(query: string): Promise<LLMLayerResult[]> {
  const apiKey = process.env.LLMLAYER_API_KEY;
  if (!apiKey) {
    console.warn('[LLMLayer] No LLMLAYER_API_KEY configured');
    return [];
  }

  try {
    const res = await fetch('https://api.llmlayer.dev/api/v2/web_search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_type: 'general',
        location: 'us',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[LLMLayer] API error ${res.status}: ${errBody}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((r: any) => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      date: r.date,
      content: r.snippet,
      url: r.link || '',
    }));
  } catch (error: any) {
    console.error('[LLMLayer] Search error:', error.message || error);
    return [];
  }
}

/**
 * Scrape a URL and return its content as markdown text.
 * Uses LLMLayer Scraper API with advanced proxy for protected sites.
 * Cost: $0.001 per format requested.
 */
export async function scrapePage(url: string): Promise<string | null> {
  const apiKey = process.env.LLMLAYER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.llmlayer.dev/api/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        main_content_only: true,
        advanced_proxy: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.markdown || '';
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

// Export with compatible name
export const searchWeb = searchLLMLayer;
