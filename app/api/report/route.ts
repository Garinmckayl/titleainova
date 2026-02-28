import { NextRequest, NextResponse } from 'next/server';
import { getSearch } from '@/lib/turso';

export const runtime = 'nodejs';

/**
 * Public API endpoint for shared reports.
 * No auth required — anyone with the link can view the report.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id');

  if (!idParam) {
    return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
  }

  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
  }

  try {
    const row = await getSearch(id);
    if (!row) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Return the report data (excluding sensitive user info)
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        address: row.address,
        county: row.county,
        parcel_id: row.parcel_id,
        source: row.source,
        created_at: row.created_at,
        review_status: row.review_status,
        screenshots: row.screenshots,
        report: row.report,
      },
    });
  } catch (err: any) {
    console.error('[/api/report GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
