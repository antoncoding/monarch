import { type NextRequest, NextResponse } from 'next/server';
import { MONARCH_GRAPHQL_API_KEY, getMonarchGraphqlUrl } from '../utils';
import { reportApiRouteError } from '@/utils/sentry-server';

export async function POST(request: NextRequest) {
  if (!MONARCH_GRAPHQL_API_KEY) {
    console.error('[Monarch GraphQL API] Missing NEXT_PUBLIC_MONARCH_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const response = await fetch(getMonarchGraphqlUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MONARCH_GRAPHQL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch GraphQL API] Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch Monarch GraphQL data' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    reportApiRouteError(error, {
      route: '/api/monarch/graphql',
      method: 'POST',
      status: 500,
    });
    console.error('[Monarch GraphQL API] Failed to fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch Monarch GraphQL data' }, { status: 500 });
  }
}
