/**
 * County health monitoring API.
 *
 * Endpoints:
 *   GET /api/monitoring                — Get all cached health statuses + coverage analysis
 *   POST /api/monitoring               — Trigger a full health check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCounties } from '@/lib/agents/title-search/property-lookup';
import {
  getAllHealthStatuses,
  runFullHealthCheck,
  analyzeCoverageGaps,
} from '@/lib/agents/title-search/county-monitor';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  try {
    const counties = getAllCounties();
    const healthStatuses = getAllHealthStatuses();
    const coverageGaps = analyzeCoverageGaps(counties.map(c => ({ name: c.name, state: c.state })));

    return NextResponse.json({
      success: true,
      data: {
        totalCounties: counties.length,
        healthStatuses,
        coverageGaps,
        summary: {
          online: healthStatuses.filter(h => h.isOnline).length,
          offline: healthStatuses.filter(h => !h.isOnline).length,
          unchecked: counties.length - healthStatuses.length,
          statesWithCoverage: new Set(counties.map(c => c.state)).size,
        },
      },
    });
  } catch (err: any) {
    console.error('[/api/monitoring GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const counties = getAllCounties();
    const result = await runFullHealthCheck(
      counties.map(c => ({ name: c.name, state: c.state, recorderUrl: c.recorderUrl }))
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        coverageGaps: analyzeCoverageGaps(counties.map(c => ({ name: c.name, state: c.state }))),
      },
    });
  } catch (err: any) {
    console.error('[/api/monitoring POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
