import { NextRequest, NextResponse } from 'next/server';
import { getRecentSearches, getSearch } from '@/lib/turso';

export const runtime = 'nodejs';

/**
 * GET /api/searches          → list recent searches (limit=20)
 * GET /api/searches?id=<n>   → get a single search by ID
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id');

  try {
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      const row = await getSearch(id);
      if (!row) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      // report is already an object from Neon JSONB
      return NextResponse.json({ success: true, data: row });
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;
    const rows = await getRecentSearches(limit);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[/api/searches]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
