import { NextResponse } from 'next/server';

const ORACLE_GIST_BASE_URL = process.env.ORACLE_GIST_BASE_URL;

export async function GET(request: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;

  console.log(`[oracle-metadata API] Fetching for chain ${chainId}, GIST_URL=${ORACLE_GIST_BASE_URL ? 'set' : 'NOT SET'}`);

  if (!ORACLE_GIST_BASE_URL) {
    console.error('[oracle-metadata API] ORACLE_GIST_BASE_URL not configured!');
    return NextResponse.json({ error: 'Oracle metadata source not configured' }, { status: 500 });
  }

  const chainIdNum = Number.parseInt(chainId, 10);
  if (Number.isNaN(chainIdNum)) {
    return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 });
  }

  try {
    const url = `${ORACLE_GIST_BASE_URL}/oracles.${chainId}.json`;
    const response = await fetch(url, {
      next: { revalidate: 1800 }, // Cache for 30 minutes
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: `No oracle data for chain ${chainId}` }, { status: 404 });
      }
      throw new Error(`Failed to fetch oracle data: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch oracle metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch oracle metadata' }, { status: 500 });
  }
}
