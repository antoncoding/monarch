import { type NextRequest, NextResponse } from 'next/server';

const TEST_ENDPOINT = 'https://api.monarchlend.xyz/v1/markets/metrics?limit=1&offset=0';
const API_KEY_PATTERN = /^mk_(live|test)_[A-Za-z0-9-]{8,32}_[A-Za-z0-9_-]{20,120}$/;

type TestApiKeyRequestBody = {
  apiKey?: unknown;
};

type MarketMetricsResponse = {
  total?: unknown;
  markets?: unknown;
  error?: unknown;
};

export async function POST(request: NextRequest) {
  const apiKey = await readApiKey(request);
  if ('error' in apiKey) {
    return NextResponse.json({ error: apiKey.error }, { status: 400 });
  }

  const response = await fetch(TEST_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey.value,
    },
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => ({}))) as MarketMetricsResponse;
  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: response.status,
        error: typeof body.error === 'string' ? body.error : 'API key test failed.',
      },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    status: response.status,
    endpoint: '/v1/markets/metrics?limit=1&offset=0',
    total: typeof body.total === 'number' ? body.total : null,
    sampleCount: Array.isArray(body.markets) ? body.markets.length : null,
  });
}

async function readApiKey(request: NextRequest): Promise<{ value: string } | { error: string }> {
  let body: TestApiKeyRequestBody;
  try {
    body = (await request.json()) as TestApiKeyRequestBody;
  } catch {
    return { error: 'Invalid JSON body.' };
  }

  if (typeof body.apiKey !== 'string') {
    return { error: 'apiKey is required.' };
  }

  const value = body.apiKey.trim();
  if (!API_KEY_PATTERN.test(value)) {
    return { error: 'Invalid API key format.' };
  }

  return { value };
}
