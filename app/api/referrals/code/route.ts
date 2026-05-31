import { type NextRequest, NextResponse } from 'next/server';
import { callDataApiInternal } from '@/utils/dataApiInternal';
import { parseReferralCodeRequestMessage } from '@/utils/referralRequest';
import { verifySignedWalletRequest } from '@/utils/signedWalletRequest';

interface ReferralCodeResponse {
  code?: unknown;
  referrerWallet?: unknown;
  error?: unknown;
}

interface ReferralCodeRequestBody {
  address?: unknown;
  signature?: unknown;
  message?: unknown;
}

export async function POST(request: NextRequest) {
  const body = await readReferralCodeRequest(request);
  if ('error' in body) return NextResponse.json({ error: body.error }, { status: 400 });

  const parsedMessage = parseReferralCodeRequestMessage(body.message);
  if (!parsedMessage) {
    return NextResponse.json({ error: 'Invalid signature message.' }, { status: 400 });
  }

  const verification = await verifySignedWalletRequest({
    request,
    address: body.address,
    signature: body.signature,
    message: body.message,
    parsedMessage,
  });
  if (!verification.ok) return NextResponse.json({ error: verification.error }, { status: verification.status });

  try {
    const response = await callDataApiInternal('/internal/referrals/code', {
      referrerWallet: verification.address,
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

async function readReferralCodeRequest(request: NextRequest): Promise<
  | {
      address: string;
      signature: string;
      message: string;
    }
  | { error: string }
> {
  let body: ReferralCodeRequestBody;
  try {
    body = (await request.json()) as ReferralCodeRequestBody;
    if (!isRecord(body)) {
      return { error: 'Invalid JSON body.' };
    }
  } catch {
    return { error: 'Invalid JSON body.' };
  }

  const address = readRequiredString(body.address);
  const signature = readRequiredString(body.signature);
  const message = readRequiredString(body.message);

  if (!address || !signature || !message) {
    return { error: 'address, signature, and message are required.' };
  }

  return {
    address,
    signature,
    message,
  };
}

function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
