import { type NextRequest, NextResponse } from 'next/server';

const MONARCH_API_ENDPOINT = process.env.MONARCH_API_ENDPOINT ?? 'http://localhost:3000';
const MONARCH_API_KEY = process.env.MONARCH_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Pass through all query params
  const params = new URLSearchParams();
  const chainId = searchParams.get('chain_id');
  const sortBy = searchParams.get('sort_by');
  const sortOrder = searchParams.get('sort_order');
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

  console.log('getting limit', limit, 'offset', offset);

  if (chainId) params.set('chain_id', chainId);
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder) params.set('sort_order', sortOrder);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);

  const url = `${MONARCH_API_ENDPOINT}/v1/markets/metrics?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-Key': MONARCH_API_KEY,
      },
      // Cache for 15 minutes on the edge
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Monarch Metrics API] Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch market metrics' }, { status: response.status });
    }

    const data = await response.json();
    console.log('data', data.markets?.length);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Monarch Metrics API] Failed to fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch market metrics' }, { status: 500 });
  }
}
