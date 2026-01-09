import { type NextRequest, NextResponse } from 'next/server';
import { MONARCH_API_KEY, getMonarchUrl } from '../utils';

export async function GET(req: NextRequest) {
  if (!MONARCH_API_KEY) {
    console.error('[Monarch Liquidations API] Missing MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const chainId = req.nextUrl.searchParams.get('chain_id');

  try {
    const url = getMonarchUrl('/v1/liquidations');
    if (chainId) url.searchParams.set('chain_id', chainId);

    const response = await fetch(url, {
      headers: { 'X-API-Key': MONARCH_API_KEY },
      next: { revalidate: 300 },
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
