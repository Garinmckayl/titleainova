import { NextRequest, NextResponse } from 'next/server';

/**
 * Nova Act Browser Automation — HTTP proxy to Python sidecar
 *
 * The Python sidecar (nova-act-service/main.py) runs alongside Next.js on a
 * machine that has internet access. It uses the Nova Act SDK with IAM credentials
 * to drive a real Chromium browser against county recorder websites.
 *
 * Set NOVA_ACT_SERVICE_URL in .env.local / Vercel env vars:
 *   NOVA_ACT_SERVICE_URL=http://localhost:8001     (local dev)
 *   NOVA_ACT_SERVICE_URL=http://<ec2-ip>:8001      (production)
 *
 * Workflow: arn:aws:nova-act:us-east-1:451870923073:workflow-definition/title
 */

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — browser automation takes time

const COUNTY_URLS: Record<string, string> = {
  'Harris County':  'https://media.cclerk.hctx.net/RealEstate/Search',
  'Dallas County':  'https://dallas.tx.publicsearch.us/',
  'Tarrant County': 'https://tarrant.tx.publicsearch.us/',
  'Bexar County':   'https://bexar.tx.publicsearch.us/',
  'Travis County':  'https://www.tccsearch.org/RealEstate/SearchEntry.aspx',
};

export async function POST(req: NextRequest) {
  const { address, county = 'Harris County' } = await req.json();

  if (!address) {
    return NextResponse.json({ error: 'address is required', success: false }, { status: 400 });
  }

  const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;
  if (!sidecarUrl) {
    return NextResponse.json({
      error: 'NOVA_ACT_SERVICE_URL is not configured.',
      success: false,
      fallback: true,
    }, { status: 503 });
  }

  try {
    console.log(`[NovaAct] Forwarding to sidecar: ${address} in ${county}`);
    const res = await fetch(`${sidecarUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, county }),
      signal: AbortSignal.timeout(270000), // 4.5 min
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sidecar returned ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[NovaAct] Sidecar error:', error.message);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

/** Health / status check — proxies to sidecar health endpoint */
export async function GET() {
  const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;

  if (!sidecarUrl) {
    return NextResponse.json({
      status: 'unconfigured',
      message: 'Set NOVA_ACT_SERVICE_URL to point to the nova-act-service sidecar.',
    });
  }

  try {
    const res = await fetch(`${sidecarUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const health = await res.json();
    return NextResponse.json({ status: 'ok', sidecar: health });
  } catch {
    return NextResponse.json({
      status: 'unreachable',
      sidecar_url: sidecarUrl,
      message: 'Could not reach Nova Act sidecar. Is main.py running?',
    });
  }
}
