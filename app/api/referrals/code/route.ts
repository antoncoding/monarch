import { type NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { callDataApiInternal } from '@/utils/dataApiInternal';

interface ReferralCodeResponse {
  code?: unknown;
  referrerWallet?: unknown;
  error?: unknown;
}

interface ReferralCodeErrorResponse {
  error: string;
  debug?: {
    upstreamStatus: number;
    upstreamContentType: string | null;
    upstreamCfRay: string | null;
    upstreamRailwayRequestId: string | null;
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.referrerWallet !== 'string' || !isAddress(body.referrerWallet)) {
    return NextResponse.json({ error: 'Invalid referrer wallet.' }, { status: 400 });
  }

  try {
    const response = await callDataApiInternal('/internal/referrals/code', {
      referrerWallet: body.referrerWallet,
    });
    const data = (await response.json().catch(() => ({}))) as ReferralCodeResponse;

    if (!response.ok || typeof data.code !== 'string') {
      const errorBody: ReferralCodeErrorResponse = {
        error: typeof data.error === 'string' ? data.error : 'Failed to create referral code.',
      };

      if (process.env.VERCEL_ENV !== 'production') {
        errorBody.debug = {
          upstreamStatus: response.status,
          upstreamContentType: response.headers.get('content-type'),
          upstreamCfRay: response.headers.get('cf-ray'),
          upstreamRailwayRequestId: response.headers.get('x-railway-request-id'),
        };
      }

      return NextResponse.json(errorBody, { status: response.status || 502 });
    }

    return NextResponse.json({
      code: data.code,
      referrerWallet: data.referrerWallet,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create referral code.' }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
