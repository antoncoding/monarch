import { type NextRequest, NextResponse } from 'next/server';
import { createPublicClient, getAddress, http, isAddress, type Address, type Chain } from 'viem';
import { verifyMessage } from 'viem/actions';
import { arbitrum, base, etherlink, hyperEvm, mainnet, monad, optimism, polygon, unichain } from 'viem/chains';
import { parseApiKeyRequestMessage } from '@/utils/apiKeyRequest';
import { SupportedNetworks, isSupportedNetwork } from '@/utils/supported-networks';

const DEFAULT_ADMIN_ENDPOINT = 'https://api.monarchlend.xyz/admin/api-keys';
const REQUEST_TTL_MS = 10 * 60 * 1000;
const REQUEST_CLOCK_SKEW_MS = 60 * 1000;
const ADMIN_REQUEST_TIMEOUT_MS = 10_000;
const VERCEL_PREVIEW_HOST_SUFFIX = '.vercel.app';
const FIRST_PARTY_HOSTS = new Set(['monarchlend.xyz', 'www.monarchlend.xyz']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const VERIFICATION_CHAINS: Record<SupportedNetworks, Chain> = {
  [SupportedNetworks.Mainnet]: mainnet,
  [SupportedNetworks.Optimism]: optimism,
  [SupportedNetworks.Base]: base,
  [SupportedNetworks.Polygon]: polygon,
  [SupportedNetworks.Unichain]: unichain,
  [SupportedNetworks.Arbitrum]: arbitrum,
  [SupportedNetworks.Etherlink]: etherlink,
  [SupportedNetworks.HyperEVM]: hyperEvm,
  [SupportedNetworks.Monad]: monad,
};

const RPC_ENV_BY_CHAIN: Partial<Record<SupportedNetworks, string | undefined>> = {
  [SupportedNetworks.Mainnet]: process.env.NEXT_PUBLIC_ETHEREUM_RPC,
  [SupportedNetworks.Optimism]: process.env.NEXT_PUBLIC_OPTIMISM_RPC,
  [SupportedNetworks.Base]: process.env.NEXT_PUBLIC_BASE_RPC,
  [SupportedNetworks.Polygon]: process.env.NEXT_PUBLIC_POLYGON_RPC,
  [SupportedNetworks.Unichain]: process.env.NEXT_PUBLIC_UNICHAIN_RPC,
  [SupportedNetworks.Arbitrum]: process.env.NEXT_PUBLIC_ARBITRUM_RPC,
  [SupportedNetworks.Etherlink]: process.env.NEXT_PUBLIC_ETHERLINK_RPC,
  [SupportedNetworks.HyperEVM]: process.env.NEXT_PUBLIC_HYPEREVM_RPC,
  [SupportedNetworks.Monad]: process.env.NEXT_PUBLIC_MONAD_RPC,
};

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

  const applicationOrigin = getApplicationOrigin(request);
  if (!applicationOrigin) {
    return NextResponse.json({ error: 'Unsupported application origin.' }, { status: 403 });
  }

  if (parsedMessage.origin !== applicationOrigin) {
    return NextResponse.json({ error: 'Signed origin does not match request origin.' }, { status: 400 });
  }

  if (!isFreshTimestamp(parsedMessage.issuedAt)) {
    return NextResponse.json({ error: 'Signature request expired.' }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]{16,80}$/.test(parsedMessage.nonce)) {
    return NextResponse.json({ error: 'Invalid signature nonce.' }, { status: 400 });
  }

  if (!isSupportedNetwork(parsedMessage.chainId)) {
    return NextResponse.json({ error: 'Unsupported signature chain.' }, { status: 400 });
  }

  let signatureValid: boolean;
  try {
    signatureValid = await verifyWalletSignature({
      address,
      chainId: parsedMessage.chainId,
      message: body.message,
      signature: body.signature,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to verify wallet signature.' }, { status: 502 });
  }

  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid wallet signature.' }, { status: 401 });
  }

  const adminResponse = await createGatewayApiKey({
    adminToken,
    address,
    name: body.name,
    chainId: parsedMessage.chainId,
    origin: parsedMessage.origin,
    issuedAt: parsedMessage.issuedAt,
    nonce: parsedMessage.nonce,
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

  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(signature)) {
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

function verifyWalletSignature({
  address,
  chainId,
  message,
  signature,
}: {
  address: string;
  chainId: SupportedNetworks;
  message: string;
  signature: string;
}) {
  const rpcUrl = RPC_ENV_BY_CHAIN[chainId]?.trim() || undefined;
  const client = createPublicClient({
    chain: VERIFICATION_CHAINS[chainId],
    transport: http(rpcUrl),
  });

  return verifyMessage(client, {
    address: address as Address,
    message,
    signature: signature as `0x${string}`,
  });
}

function getApplicationOrigin(request: NextRequest): string | null {
  const host = readForwardedHeader(request.headers.get('x-forwarded-host')) ?? request.headers.get('host');
  if (!host) return null;

  if (!isAllowedApplicationHost(host)) return null;

  const protocol = readForwardedHeader(request.headers.get('x-forwarded-proto')) ?? new URL(request.url).protocol.replace(/:$/, '');
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function readForwardedHeader(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

function isAllowedApplicationHost(host: string): boolean {
  const hostname = host.toLowerCase().replace(/:\d+$/, '');
  return FIRST_PARTY_HOSTS.has(hostname) || hostname.endsWith(VERCEL_PREVIEW_HOST_SUFFIX) || LOOPBACK_HOSTS.has(hostname);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
