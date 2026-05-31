import 'server-only';

import { getAddress, isAddress, type Address } from 'viem';
import { verifyMessage } from 'viem/actions';
import { getClient } from '@/utils/rpc';
import {
  getWalletSignatureMessage,
  WALLET_SIGNATURE_CHAIN_ID,
  WALLET_SIGNATURE_CLOCK_SKEW_MS,
  WALLET_SIGNATURE_TTL_MS,
  type WalletSignaturePurpose,
} from '@/utils/walletSignature';

export async function verifySignedWallet({
  address,
  signature,
  timestamp,
  purpose,
}: {
  address: string;
  signature: string;
  timestamp: number;
  purpose: WalletSignaturePurpose;
}): Promise<Address | null> {
  if (!isAddress(address) || !Number.isSafeInteger(timestamp)) return null;

  const now = Date.now();
  if (timestamp > now + WALLET_SIGNATURE_CLOCK_SKEW_MS || now - timestamp > WALLET_SIGNATURE_TTL_MS) return null;

  const wallet = getAddress(address);
  const message = getWalletSignatureMessage({ purpose, wallet, timestamp });

  try {
    const valid = await verifyMessage(getClient(WALLET_SIGNATURE_CHAIN_ID), {
      address: wallet,
      message,
      signature: signature as `0x${string}`,
    });

    return valid ? wallet : null;
  } catch {
    return null;
  }
}
