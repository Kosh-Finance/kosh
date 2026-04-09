import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/prove
 *
 * Server-side proxy to the Midnight proof server.
 * Forwards the binary proving payload to the proof server's /prove endpoint
 * and returns the proven bytes. Bypasses browser CORS restrictions.
 *
 * The body is a binary payload built via ledger-v8's createProvingPayload(),
 * which embeds the serialized preimage + (optionally) the prover key material.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const PROOF_SERVER_URL =
  process.env.NEXT_PUBLIC_PROOF_SERVER_URL ?? 'https://proof-server.preprod.midnight.network';

export async function POST(req: NextRequest) {
  try {
    const body = await req.arrayBuffer();
    const upstream = await fetch(`${PROOF_SERVER_URL}/prove`, {
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
    const proven = await upstream.arrayBuffer();
    return new NextResponse(proven, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Proof proxy failed: ${msg}` }, { status: 502 });
  }
}
