import { type NextRequest, NextResponse } from 'next/server';
import { MONARCH_API_KEY, getMonarchUrl } from '../../utils';
import { reportApiRouteError } from '@/utils/sentry-server';

export async function GET(req: NextRequest) {
  if (!MONARCH_API_KEY) {
    console.error('[Monarch Attribution API] Missing MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;

  try {
    const url = getMonarchUrl('/v1/attribution/scoreboard');
    for (const key of ['start_ts', 'end_ts', 'chain_id']) {
      const value = searchParams.get(key);
      if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: { 'X-API-Key': MONARCH_API_KEY },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch Attribution API] Scoreboard error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch attribution scoreboard' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    reportApiRouteError(error, {
      route: '/api/monarch/attribution/scoreboard',
      method: 'GET',
      status: 500,
    });
    console.error('[Monarch Attribution API] Failed to fetch scoreboard:', error);
    return NextResponse.json({ error: 'Failed to fetch attribution scoreboard' }, { status: 500 });
  }
}
