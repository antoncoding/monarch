import { type NextRequest, NextResponse } from 'next/server';
import { getAddress, isAddress, isHash } from 'viem';
import { callDataApiInternal } from '@/utils/dataApiInternal';

interface ReferralAttributionBody {
  referredWallet?: string;
  referralCode?: string;
  chainId?: number;
  txHash?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ReferralAttributionBody | null;

  if (
    !body ||
    typeof body.referredWallet !== 'string' ||
    !isAddress(body.referredWallet) ||
    typeof body.referralCode !== 'string' ||
    !body.referralCode.trim() ||
    typeof body.chainId !== 'number' ||
    !Number.isInteger(body.chainId) ||
    typeof body.txHash !== 'string' ||
    !isHash(body.txHash)
  ) {
    return NextResponse.json({ error: 'Invalid referral attribution request.' }, { status: 400 });
  }

  try {
    const response = await callDataApiInternal('/internal/referrals/attribute', {
      referredWallet: getAddress(body.referredWallet),
      referralCode: body.referralCode.trim(),
      chainId: body.chainId,
      txHash: body.txHash,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };

    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data.error === 'string' ? data.error : 'Failed to record referral attribution.' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to record referral attribution.' }, { status: 500 });
  }
}
