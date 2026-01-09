import { type NextRequest, NextResponse } from 'next/server';

const MONARCH_API_ENDPOINT = process.env.MONARCH_API_ENDPOINT;
const MONARCH_API_KEY = process.env.MONARCH_API_KEY;

export async function GET(req: NextRequest) {
  if (!MONARCH_API_ENDPOINT || !MONARCH_API_KEY) {
    console.error('[Monarch Liquidations API] Missing required env vars: MONARCH_API_ENDPOINT or MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;
  const chainId = searchParams.get('chain_id');

  const url = new URL('/v1/liquidations', MONARCH_API_ENDPOINT.replace(/\/$/, ''));
  if (chainId) url.searchParams.set('chain_id', chainId);

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': MONARCH_API_KEY },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch Liquidations API] Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch liquidations' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Monarch Liquidations API] Failed to fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch liquidations' }, { status: 500 });
  }
}
