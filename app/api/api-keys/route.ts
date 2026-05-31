import { type NextRequest, NextResponse } from 'next/server';
import { parseApiKeyRequestMessage } from '@/utils/apiKeyRequest';
import { verifyApiKeySignatureRequest } from '@/utils/apiKeySignatureRequest';

const DEFAULT_ADMIN_ENDPOINT = 'https://data-api-gateway-worker.antonassocareer.workers.dev/admin/api-keys';
const ADMIN_REQUEST_TIMEOUT_MS = 10_000;

interface CreateApiKeyRequestBody {
  address?: unknown;
  signature?: unknown;
  message?: unknown;
  name?: unknown;
}

interface AdminCreateApiKeyResponse {
  apiKey?: unknown;
  key?: unknown;
  error?: unknown;
}

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

  const verification = await verifyApiKeySignatureRequest({
    request,
    address: body.address,
    signature: body.signature,
    message: body.message,
    parsedMessage,
  });
  if (!verification.ok) return NextResponse.json({ error: verification.error }, { status: verification.status });

  const adminResponse = await createGatewayApiKey({
    adminToken,
    address: verification.address,
    name: body.name,
    chainId: verification.chainId,
    origin: verification.origin,
    issuedAt: verification.issuedAt,
    nonce: verification.nonce,
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
    if (!isRecord(body)) {
      return { error: 'Invalid JSON body.' };
    }
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
  chainId,
  origin,
  issuedAt,
  nonce,
}: {
  adminToken: string;
  address: string;
  name: string;
  chainId: number;
  origin: string;
  issuedAt: string;
  nonce: string;
}) {
  const adminEndpoint = process.env.MONARCH_API_KEYS_ADMIN_URL?.trim() || DEFAULT_ADMIN_ENDPOINT;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS);
  let response: Response;
  let body: AdminCreateApiKeyResponse;

  try {
    response = await fetch(adminEndpoint, {
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
          chainId,
          origin,
          signedAt: issuedAt,
          requestNonce: nonce,
          createdBy: 'monarch-api-key-console',
        },
      }),
      signal: controller.signal,
    });
    body = (await response.json().catch(() => ({}))) as AdminCreateApiKeyResponse;
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    return NextResponse.json({ error: status === 504 ? 'API gateway timed out.' : 'Failed to connect to the API gateway.' }, { status });
  } finally {
    clearTimeout(timeout);
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

  return NextResponse.json(
    {
      apiKey: body.apiKey,
      key: body.key,
    },
    { status: 201 },
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
