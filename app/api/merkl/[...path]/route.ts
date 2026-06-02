import { type NextRequest, NextResponse } from 'next/server';

const MERKL_API_BASE_URL = 'https://api.merkl.xyz';
const MERKL_API_TIMEOUT_MS = 15_000;

type MerklRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: NextRequest, context: MerklRouteContext) {
  const { path = [] } = await context.params;
  const targetPath = path.join('/');

  if (!targetPath.startsWith('v4/')) {
    return NextResponse.json({ error: 'Unsupported Merkl API path.' }, { status: 400 });
  }

  const targetUrl = new URL(`/${targetPath}`, MERKL_API_BASE_URL);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    targetUrl.searchParams.append(key, value);
  }

  const headers: Record<string, string> = {};
  const apiKey = process.env.MERKL_API_KEY?.trim();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(MERKL_API_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Merkl API timed out.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to connect to Merkl API.' }, { status: 502 });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
