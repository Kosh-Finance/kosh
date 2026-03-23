import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/deploy
 *
 * Deploys a new Kosh ROSCA circle to the local Midnight node.
 * Runs server-side so it can use Node.js APIs (fs, LevelDB) safely.
 *
 * Body: { contributionAmount, memberCap, roundCount, roundDuration }
 * Returns: { contractAddress }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contributionAmount, memberCap, roundCount, roundDuration } = body;

    if (!contributionAmount || !memberCap || !roundCount || !roundDuration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Dynamic import keeps Node.js modules (fs, LevelDB) out of the browser bundle
    const { deployKoshCircle } = await import('@/dapp/deploy');

    const result = await deployKoshCircle({
      contributionAmount: BigInt(contributionAmount),
      memberCap:          Number(memberCap),
      roundCount:         Number(roundCount),
      roundDuration:      BigInt(roundDuration),
    });

    return NextResponse.json({ contractAddress: result.contractAddress });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Friendly error for the most common failure: node not running
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect')) {
      return NextResponse.json(
        { error: 'Cannot reach Midnight node. Is the Docker stack running? Run: docker compose up -d' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
