import 'server-only';

import { getAddress, isAddress, type Address } from 'viem';
import { verifyMessage } from 'viem/actions';
import { getClient } from '@/utils/rpc';
import { type SupportedNetworks, isSupportedNetwork } from '@/utils/supported-networks';

const SIGNATURE_PATTERN = /^0x(?:[0-9a-fA-F]{2})+$/;

type WalletSignatureVerificationResult =
  | {
      ok: true;
      address: string;
      chainId: SupportedNetworks;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function verifyWalletMessage({
  address: rawAddress,
  signedWallet,
  chainId,
  message,
  signature,
}: {
  address: string;
  signedWallet: string;
  chainId: number;
  message: string;
  signature: string;
}): Promise<WalletSignatureVerificationResult> {
  if (!SIGNATURE_PATTERN.test(signature)) {
    return { ok: false, status: 400, error: 'Invalid signature format.' };
  }

  if (!isAddress(rawAddress) || !isAddress(signedWallet)) {
    return { ok: false, status: 400, error: 'Invalid wallet address.' };
  }

  const address = getAddress(rawAddress);
  if (getAddress(signedWallet) !== address) {
    return { ok: false, status: 400, error: 'Signed wallet does not match connected wallet.' };
  }

  if (!isSupportedNetwork(chainId)) {
    return { ok: false, status: 400, error: 'Unsupported signature chain.' };
  }

  try {
    const signatureValid = await verifyMessage(getClient(chainId), {
      address: address as Address,
      message,
      signature: signature as `0x${string}`,
    });

    if (!signatureValid) {
      return { ok: false, status: 401, error: 'Invalid wallet signature.' };
    }
  } catch {
    return { ok: false, status: 502, error: 'Failed to verify wallet signature.' };
  }

  return {
    ok: true,
    address,
    chainId,
  };
}
