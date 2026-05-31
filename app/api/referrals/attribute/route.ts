import { type NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { callDataApiInternal } from '@/utils/dataApiInternal';

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const referredWallet = readString(body.referredWallet);
  const referralCode = readString(body.referralCode);
  const chainId = typeof body.chainId === 'number' ? body.chainId : Number.NaN;
  const txHash = readString(body.txHash);

  if (
    !referredWallet ||
    !isAddress(referredWallet) ||
    !referralCode ||
    !Number.isInteger(chainId) ||
    !txHash ||
    !TX_HASH_PATTERN.test(txHash)
  ) {
    return NextResponse.json({ error: 'Invalid referral attribution request.' }, { status: 400 });
  }

  try {
    const response = await callDataApiInternal('/internal/referrals/attribute', {
      referredWallet,
      referralCode,
      chainId,
      txHash,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };

    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data.error === 'string' ? data.error : 'Failed to record referral attribution.' },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to record referral attribution.' }, { status: 500 });
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
