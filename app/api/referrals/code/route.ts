import { type NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { callDataApiInternal } from '@/utils/dataApiInternal';

interface ReferralCodeResponse {
  code?: unknown;
  referrerWallet?: unknown;
  error?: unknown;
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
      return NextResponse.json(
        { error: typeof data.error === 'string' ? data.error : 'Failed to create referral code.' },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json({
      code: data.code,
      referrerWallet: data.referrerWallet,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create referral code.' }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
