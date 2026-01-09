import { type NextRequest, NextResponse } from 'next/server';
import { MONARCH_API_KEY, getMonarchUrl } from '../utils';

export async function GET(req: NextRequest) {
  if (!MONARCH_API_KEY) {
    console.error('[Monarch Metrics API] Missing MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;

  try {
    const url = getMonarchUrl('/v1/markets/metrics');
    for (const key of ['chain_id', 'sort_by', 'sort_order', 'limit', 'offset']) {
      const value = searchParams.get(key);
      if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: { 'X-API-Key': MONARCH_API_KEY },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch Metrics API] Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch market metrics' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Monarch Metrics API] Failed to fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch market metrics' }, { status: 500 });
  }
}
