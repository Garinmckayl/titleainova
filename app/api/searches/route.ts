import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getRecentSearches, getSearch, deleteSearch } from '@/lib/turso';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Auth is optional — signed-in users see their own searches, guests see all recent
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session.userId;
  } catch { /* Clerk not configured */ }

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
    const rows = await getRecentSearches(limit, userId ?? undefined);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[/api/searches]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id');
  if (!idParam) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const id = parseInt(idParam, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    await deleteSearch(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[/api/searches DELETE]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
