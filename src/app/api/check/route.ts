import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/check
 *
 * Server-side proxy to the Midnight proof server's /check endpoint.
 * Forwards a binary check payload (built via createCheckPayload()) and
 * returns the binary result. Bypasses browser CORS restrictions.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const PROOF_SERVER_URL =
  process.env.NEXT_PUBLIC_PROOF_SERVER_URL ?? 'https://proof-server.preprod.midnight.network';

export async function POST(req: NextRequest) {
  try {
    const body = await req.arrayBuffer();
    const upstream = await fetch(`${PROOF_SERVER_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: `Proof server returned ${upstream.status}: ${text}` },
        { status: upstream.status },
      );
    }
    const result = await upstream.arrayBuffer();
    return new NextResponse(result, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Check proxy failed: ${msg}` }, { status: 502 });
  }
}
