import axios from 'axios';

export async function searchTavily(query: string): Promise<any[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  
  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      include_raw_content: true,
      max_results: 5
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Tavily search error:', error);
    return [];
  }
}

export const tavilySearch = searchTavily;
