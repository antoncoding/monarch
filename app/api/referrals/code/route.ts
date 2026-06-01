import { type NextRequest, NextResponse } from 'next/server';
import { callDataApiInternal } from '@/utils/dataApiInternal';
import { verifySignedWallet } from '@/utils/serverWalletSignature';

interface ReferralCodeBody {
  address?: string;
  signature?: string;
  timestamp?: number;
}

interface ReferralCodeResponse {
  code?: unknown;
  referrerWallet?: unknown;
  error?: unknown;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ReferralCodeBody | null;
  if (!body || typeof body.address !== 'string' || typeof body.signature !== 'string' || typeof body.timestamp !== 'number') {
    return NextResponse.json({ error: 'address, signature, and timestamp are required.' }, { status: 400 });
  }

  const address = await verifySignedWallet({
    address: body.address,
    signature: body.signature,
    timestamp: body.timestamp,
    purpose: 'referral link',
  });
  if (!address) {
    return NextResponse.json({ error: 'Invalid wallet signature.' }, { status: 401 });
  }

  try {
    const response = await callDataApiInternal('/internal/referrals/code', {
      referrerWallet: address,
    });
    const data = (await response.json().catch(() => ({}))) as ReferralCodeResponse;

    if (!response.ok || typeof data.code !== 'string') {
      return NextResponse.json(
        { error: typeof data.error === 'string' ? data.error : 'Failed to create referral code.' },
        { status: response.ok ? 502 : response.status },
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
