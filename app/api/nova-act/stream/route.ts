import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * SSE proxy: forwards the /search-stream SSE from the Python browser agent sidecar
 * directly to the browser so the UI can render live progress logs.
 *
 * POST /api/nova-act/stream  { address, county }
 * → streams  data: {"type":"progress","step":"...","message":"..."}\n\n
 *            data: {"type":"result","data":{...}}\n\n
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, county = 'Harris County' } = body;

  if (!address) {
    return new Response(
      JSON.stringify({ error: 'address is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;

  // Pipe the upstream SSE stream straight through to the client.
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${sidecarUrl}/search-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, county }),
      // @ts-ignore — Node 18+ fetch supports duplex
      duplex: 'half',
      signal: AbortSignal.timeout(280_000), // 4.5 min
    });
  } catch (err: any) {
    // Sidecar unreachable — emit a single error event
    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: `Browser agent sidecar unreachable: ${err.message}` })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    return new Response(errStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: `Sidecar returned HTTP ${upstreamRes.status}` })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    return new Response(errStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Pass the upstream body stream through directly
  return new Response(upstreamRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
