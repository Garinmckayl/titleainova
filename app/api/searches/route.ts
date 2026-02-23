import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getRecentSearches, getSearch } from '@/lib/turso';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id');

  try {
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      const row = await getSearch(id);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;
    const rows = await getRecentSearches(limit, userId);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[/api/searches]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
