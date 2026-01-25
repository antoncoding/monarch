import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Proxy API route for Monarch Indexer
 *
 * Validates auth via httpOnly cookie, then proxies to the actual indexer.
 * The real endpoint URL is never exposed to the client.
 *
 * Environment variables (server-side only):
 * - MONARCH_INDEXER_ENDPOINT: The actual GraphQL endpoint URL
 * - ADMIN_V2_PASSWORD_HASH: Expected password hash (for cookie validation)
 */

const INDEXER_ENDPOINT = process.env.MONARCH_INDEXER_ENDPOINT;
const EXPECTED_HASH = process.env.ADMIN_V2_PASSWORD_HASH;
const COOKIE_NAME = 'monarch_admin_session';

export async function POST(request: NextRequest) {
  // Validate auth cookie
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);

  if (!EXPECTED_HASH || !session?.value || session.value !== EXPECTED_HASH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!INDEXER_ENDPOINT) {
    return NextResponse.json({ error: 'Indexer endpoint not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    const response = await fetch(INDEXER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Indexer request failed: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Monarch indexer proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
