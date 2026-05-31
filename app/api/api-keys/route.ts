import { type NextRequest, NextResponse } from 'next/server';
import { verifySignedWallet } from '@/utils/serverWalletSignature';
import { WALLET_SIGNATURE_CHAIN_ID } from '@/utils/walletSignature';

interface CreateApiKeyBody {
  address?: string;
  signature?: string;
  timestamp?: number;
  name?: string;
}

interface AdminCreateApiKeyResponse {
  apiKey?: unknown;
  key?: unknown;
  error?: unknown;
}

const API_KEY_ADMIN_TIMEOUT_MS = 10_000;

export async function POST(request: NextRequest) {
  const adminToken = process.env.MONARCH_API_KEYS_ADMIN_TOKEN?.trim();
  const adminUrl = process.env.MONARCH_API_KEYS_ADMIN_URL?.trim();
  if (!adminToken || !adminUrl) {
    return NextResponse.json({ error: 'API key creation is not configured.' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as CreateApiKeyBody | null;
  if (!body || typeof body.address !== 'string' || typeof body.signature !== 'string' || typeof body.timestamp !== 'number') {
    return NextResponse.json({ error: 'address, signature, and timestamp are required.' }, { status: 400 });
  }

  const address = await verifySignedWallet({
    address: body.address,
    signature: body.signature,
    timestamp: body.timestamp,
    purpose: 'API key',
  });
  if (!address) {
    return NextResponse.json({ error: 'Invalid wallet signature.' }, { status: 401 });
  }

  return createGatewayApiKey({
    adminUrl,
    adminToken,
    address,
    name: typeof body.name === 'string' ? body.name : '',
    signedAt: body.timestamp,
  });
}

async function createGatewayApiKey({
  adminUrl,
  adminToken,
  address,
  name,
  signedAt,
}: {
  adminUrl: string;
  adminToken: string;
  address: string;
  name: string;
  signedAt: number;
}) {
  let response: Response;
  let body: AdminCreateApiKeyResponse;

  try {
    response = await fetch(adminUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(API_KEY_ADMIN_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Monarch API key',
        environment: 'live',
        scopes: ['data.read', 'indexer.query'],
        tier: 'free',
        rateLimitTier: 'free',
        metadata: {
          ownerAddress: address,
          signatureChainId: WALLET_SIGNATURE_CHAIN_ID,
          signedAt,
          createdBy: 'monarch-api-key-console',
        },
      }),
    });
    body = (await response.json().catch(() => ({}))) as AdminCreateApiKeyResponse;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'TimeoutError') {
      return NextResponse.json({ error: 'API gateway timed out.' }, { status: 504 });
    }

    return NextResponse.json({ error: 'Failed to connect to the API gateway.' }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: typeof body.error === 'string' ? body.error : `API gateway rejected the request with status ${response.status}.` },
      { status: response.status },
    );
  }

  if (typeof body.apiKey !== 'string') {
    return NextResponse.json({ error: 'Gateway did not return an API key.' }, { status: 502 });
  }

  return NextResponse.json({ apiKey: body.apiKey, key: body.key }, { status: 201 });
}
