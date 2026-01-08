import { type NextRequest, NextResponse } from 'next/server';

const MONARCH_API_ENDPOINT = process.env.MONARCH_API_ENDPOINT ?? 'http://localhost:3000';
const MONARCH_API_KEY = process.env.MONARCH_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const chainId = searchParams.get('chain_id');

  const params = new URLSearchParams();
  if (chainId) params.set('chain_id', chainId);

  const url = `${MONARCH_API_ENDPOINT}/v1/liquidations?${params.toString()}`;

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
