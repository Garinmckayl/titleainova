/**
 * LLMLayer Web Search API client.
 * Replaces Tavily as the web search provider.
 * Docs: https://docs.llmlayer.ai/web-search
 * Endpoint: POST https://api.llmlayer.dev/api/v2/web_search
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

    // Map to standard format compatible with existing record-retrieval code
    return results.map((r: any) => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      date: r.date,
      content: r.snippet, // Use snippet as content for downstream processing
      url: r.link || '',   // Alias for compatibility
    }));
  } catch (error: any) {
    console.error('[LLMLayer] Search error:', error.message || error);
    return [];
  }
}

// Export with Tavily-compatible name for drop-in replacement
export const searchWeb = searchLLMLayer;
