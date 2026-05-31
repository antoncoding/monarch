import 'server-only';

import { createPublicClient, getAddress, http, isAddress, type Address, type Chain } from 'viem';
import { verifyMessage } from 'viem/actions';
import { arbitrum, base, etherlink, hyperEvm, mainnet, monad, optimism, polygon, unichain } from 'viem/chains';
import { SupportedNetworks, isSupportedNetwork } from '@/utils/supported-networks';

const REQUEST_TTL_MS = 10 * 60 * 1000;
const REQUEST_CLOCK_SKEW_MS = 60 * 1000;
const VERCEL_PREVIEW_HOST_SUFFIX = '.vercel.app';
const FIRST_PARTY_HOSTS = new Set(['monarchlend.xyz', 'www.monarchlend.xyz']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SIGNATURE_PATTERN = /^0x(?:[0-9a-fA-F]{2})+$/;
const NONCE_PATTERN = /^[A-Za-z0-9-]{16,80}$/;

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

export interface WalletRequestMessage {
  wallet: string;
  chainId: number;
  origin: string;
  issuedAt: string;
  nonce: string;
}

type SignedWalletVerificationResult =
  | {
      ok: true;
      address: string;
      chainId: SupportedNetworks;
      origin: string;
      issuedAt: string;
      nonce: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function verifySignedWalletRequest({
  request,
  address: rawAddress,
  signature,
  message,
  parsedMessage,
}: {
  request: { headers: Headers; url: string };
  address: string;
  signature: string;
  message: string;
  parsedMessage: WalletRequestMessage;
}): Promise<SignedWalletVerificationResult> {
  if (!SIGNATURE_PATTERN.test(signature)) {
    return { ok: false, status: 400, error: 'Invalid signature format.' };
  }

  if (!isAddress(rawAddress) || !isAddress(parsedMessage.wallet)) {
    return { ok: false, status: 400, error: 'Invalid wallet address.' };
  }

  const address = getAddress(rawAddress);
  if (getAddress(parsedMessage.wallet) !== address) {
    return { ok: false, status: 400, error: 'Signed wallet does not match connected wallet.' };
  }

  const applicationOrigin = getApplicationOrigin(request);
  if (!applicationOrigin) {
    return { ok: false, status: 403, error: 'Unsupported application origin.' };
  }

  if (parsedMessage.origin !== applicationOrigin) {
    return { ok: false, status: 400, error: 'Signed origin does not match request origin.' };
  }

  if (!isFreshTimestamp(parsedMessage.issuedAt)) {
    return { ok: false, status: 400, error: 'Signature request expired.' };
  }

  if (!NONCE_PATTERN.test(parsedMessage.nonce)) {
    return { ok: false, status: 400, error: 'Invalid signature nonce.' };
  }

  if (!isSupportedNetwork(parsedMessage.chainId)) {
    return { ok: false, status: 400, error: 'Unsupported signature chain.' };
  }

  let signatureValid: boolean;
  try {
    signatureValid = await verifyWalletSignature({
      address,
      chainId: parsedMessage.chainId,
      message,
      signature,
    });
  } catch {
    return { ok: false, status: 502, error: 'Failed to verify wallet signature.' };
  }

  if (!signatureValid) {
    return { ok: false, status: 401, error: 'Invalid wallet signature.' };
  }

  return {
    ok: true,
    address,
    chainId: parsedMessage.chainId,
    origin: parsedMessage.origin,
    issuedAt: parsedMessage.issuedAt,
    nonce: parsedMessage.nonce,
  };
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

function getApplicationOrigin(request: { headers: Headers; url: string }): string | null {
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
