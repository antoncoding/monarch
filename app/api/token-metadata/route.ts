import { type NextRequest, NextResponse } from 'next/server';
import { fetchCachedUnknownTokenInfos } from '@/server/token-metadata-cache';
import { reportApiRouteError } from '@/utils/sentry-server';
import type { TokenAddressInput } from '@/utils/tokenMetadata';

const isTokenAddressInput = (value: unknown): value is TokenAddressInput => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TokenAddressInput>;
  return typeof candidate.address === 'string' && typeof candidate.chainId === 'number';
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { tokens?: unknown };
    const tokens = Array.isArray(body.tokens) ? body.tokens.filter(isTokenAddressInput) : [];

    if (tokens.length === 0) {
      return NextResponse.json({ tokens: {} });
    }

    const resolvedTokens = await fetchCachedUnknownTokenInfos(tokens);
    return NextResponse.json({ tokens: resolvedTokens });
  } catch (error) {
    reportApiRouteError(error, {
      route: '/api/token-metadata',
      method: 'POST',
      status: 500,
    });

    return NextResponse.json({ error: 'Failed to fetch cached token metadata' }, { status: 500 });
  }
}
