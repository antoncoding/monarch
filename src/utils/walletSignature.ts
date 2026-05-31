import { SupportedNetworks } from '@/utils/supported-networks';

export const WALLET_SIGNATURE_CHAIN_ID = SupportedNetworks.Mainnet;
export const WALLET_SIGNATURE_TTL_MS = 10 * 60 * 1000;
export const WALLET_SIGNATURE_CLOCK_SKEW_MS = 60 * 1000;

export type WalletSignaturePurpose = 'API key' | 'referral link';

// Server routes reconstruct this exact message before verification, so clients
// only prove wallet ownership; they do not choose trusted request metadata.
export function getWalletSignatureMessage({
  purpose,
  wallet,
  timestamp,
}: {
  purpose: WalletSignaturePurpose;
  wallet: string;
  timestamp: number;
}) {
  return [`Monarch ${purpose} request`, '', `Wallet: ${wallet}`, `Chain ID: ${WALLET_SIGNATURE_CHAIN_ID}`, `Timestamp: ${timestamp}`].join(
    '\n',
  );
}
