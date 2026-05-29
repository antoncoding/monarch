import { type NextRequest, NextResponse } from 'next/server';
import { getAddress, isAddress, verifyMessage } from 'viem';
import { parseApiKeyRequestMessage } from '@/utils/apiKeyRequest';

const DEFAULT_ADMIN_ENDPOINT = 'https://api.monarchlend.xyz/admin/api-keys';
const REQUEST_TTL_MS = 10 * 60 * 1000;
const REQUEST_CLOCK_SKEW_MS = 60 * 1000;

type CreateApiKeyRequestBody = {
  address?: unknown;
  signature?: unknown;
  message?: unknown;
  name?: unknown;
};

type AdminCreateApiKeyResponse = {
  apiKey?: unknown;
  key?: unknown;
  error?: unknown;
};

export async function POST(request: NextRequest) {
  const adminToken = process.env.MONARCH_API_KEYS_ADMIN_TOKEN?.trim();
  if (!adminToken) {
    return NextResponse.json({ error: 'API key creation is not configured.' }, { status: 500 });
  }

  const body = await readCreateApiKeyRequest(request);
  if ('error' in body) return NextResponse.json({ error: body.error }, { status: 400 });

  const parsedMessage = parseApiKeyRequestMessage(body.message);
  if (!parsedMessage) {
    return NextResponse.json({ error: 'Invalid signature message.' }, { status: 400 });
  }

  if (!isAddress(body.address) || !isAddress(parsedMessage.wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }

  const address = getAddress(body.address);
  if (getAddress(parsedMessage.wallet) !== address) {
    return NextResponse.json({ error: 'Signed wallet does not match connected wallet.' }, { status: 400 });
  }

  const requestOrigin = getRequestOrigin(request);
  if (requestOrigin && parsedMessage.origin !== requestOrigin) {
    return NextResponse.json({ error: 'Signed origin does not match request origin.' }, { status: 400 });
  }

  if (!isFreshTimestamp(parsedMessage.issuedAt)) {
    return NextResponse.json({ error: 'Signature request expired.' }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]{16,80}$/.test(parsedMessage.nonce)) {
    return NextResponse.json({ error: 'Invalid signature nonce.' }, { status: 400 });
  }

  const signatureValid = await verifyMessage({
    address,
    message: body.message,
    signature: body.signature as `0x${string}`,
  });

  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid wallet signature.' }, { status: 401 });
  }

  const adminResponse = await createGatewayApiKey({
    adminToken,
    address,
    name: body.name,
    origin: parsedMessage.origin,
    issuedAt: parsedMessage.issuedAt,
  });

  return adminResponse;
}

async function readCreateApiKeyRequest(request: NextRequest): Promise<
  | {
      address: string;
      signature: string;
      message: string;
      name: string;
    }
  | { error: string }
> {
  let body: CreateApiKeyRequestBody;
  try {
    body = (await request.json()) as CreateApiKeyRequestBody;
  } catch {
    return { error: 'Invalid JSON body.' };
  }

  const address = readRequiredString(body.address);
  const signature = readRequiredString(body.signature);
  const message = readRequiredString(body.message);
  const name = sanitizeKeyName(body.name);

  if (!address || !signature || !message) {
    return { error: 'address, signature, and message are required.' };
  }

  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return { error: 'Invalid signature format.' };
  }

  return {
    address,
    signature,
    message,
    name,
  };
}

async function createGatewayApiKey({
  adminToken,
  address,
  name,
  origin,
  issuedAt,
}: {
  adminToken: string;
  address: string;
  name: string;
  origin: string;
  issuedAt: string;
}) {
  const adminEndpoint = process.env.MONARCH_API_KEYS_ADMIN_URL?.trim() || DEFAULT_ADMIN_ENDPOINT;
  const response = await fetch(adminEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      environment: 'live',
      scopes: ['data.read', 'indexer.query'],
      tier: 'free',
      rateLimitTier: 'free',
      metadata: {
        ownerAddress: address,
        origin,
        signedAt: issuedAt,
        createdBy: 'monarch-api-key-console',
      },
    }),
  });

  const body = (await response.json().catch(() => ({}))) as AdminCreateApiKeyResponse;
  if (!response.ok) {
    return NextResponse.json(
      { error: typeof body.error === 'string' ? body.error : 'Failed to create API key.' },
      { status: response.status },
    );
  }

  if (typeof body.apiKey !== 'string') {
    return NextResponse.json({ error: 'Gateway did not return an API key.' }, { status: 502 });
  }

  return NextResponse.json(
    {
      apiKey: body.apiKey,
      key: body.key,
    },
    { status: 201 },
  );
}

function getRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return null;

  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function isFreshTimestamp(value: string): boolean {
  const issuedAtMs = Date.parse(value);
  if (!Number.isFinite(issuedAtMs)) return false;

  const now = Date.now();
  return issuedAtMs <= now + REQUEST_CLOCK_SKEW_MS && now - issuedAtMs <= REQUEST_TTL_MS;
}

function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeKeyName(value: unknown): string {
  if (typeof value !== 'string') return 'Monarch API key';

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Monarch API key';

  return trimmed.slice(0, 120);
}
