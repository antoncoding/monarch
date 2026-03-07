import { type NextRequest, NextResponse } from 'next/server';
import { MONARCH_API_KEY, getMonarchUrl } from '../../utils';
import { reportApiRouteError } from '@/utils/sentry-server';

export async function POST(req: NextRequest) {
  if (!MONARCH_API_KEY) {
    console.error('[Monarch Attribution API] Missing MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const url = getMonarchUrl('/v1/attribution/touchpoint');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MONARCH_API_KEY,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch Attribution API] Touchpoint error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to save attribution touchpoint' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    reportApiRouteError(error, {
      route: '/api/monarch/attribution/touchpoint',
      method: 'POST',
      status: 500,
    });
    console.error('[Monarch Attribution API] Failed to save touchpoint:', error);
    return NextResponse.json({ error: 'Failed to save attribution touchpoint' }, { status: 500 });
  }
}
