import { type NextRequest, NextResponse } from 'next/server';
import {
  MONARCH_GRAPHQL_API_KEY,
  MONARCH_GRAPHQL_TIMEOUT_MS,
  fetchMonarchUpstream,
  getMonarchGraphqlUrl,
  getMonarchRouteFailure,
} from '../utils';
import { reportApiRouteError } from '@/utils/sentry-server';

export async function POST(request: NextRequest) {
  if (!MONARCH_GRAPHQL_API_KEY) {
    console.error('[Monarch GraphQL API] Missing MONARCH_GRAPHQL_API_KEY');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const response = await fetchMonarchUpstream(getMonarchGraphqlUrl(), MONARCH_GRAPHQL_TIMEOUT_MS, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MONARCH_GRAPHQL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch GraphQL API] Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch Monarch GraphQL data' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    const failure = getMonarchRouteFailure(error, 'Failed to fetch Monarch GraphQL data', 'Monarch GraphQL request timed out');

    reportApiRouteError(error, {
      route: '/api/monarch/graphql',
      method: 'POST',
      status: failure.status,
    });
    console.error('[Monarch GraphQL API] Failed to fetch:', error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
