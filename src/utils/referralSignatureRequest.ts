import 'server-only';

import { getAddress, isAddress } from 'viem';
import type { ReferralCodeRequestMessage } from '@/utils/referralRequest';
import { SIGNATURE_PATTERN, verifyWalletSignature } from '@/utils/serverWalletSignature';
import { isSupportedNetwork } from '@/utils/supported-networks';

type ReferralSignatureVerificationResult =
  | {
      ok: true;
      address: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function verifyReferralSignatureRequest({
  address: rawAddress,
  chainId,
  signature,
  message,
  parsedMessage,
}: {
  address: string;
  chainId: number;
  signature: string;
  message: string;
  parsedMessage: ReferralCodeRequestMessage;
}): Promise<ReferralSignatureVerificationResult> {
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

  if (!isSupportedNetwork(chainId)) {
    return { ok: false, status: 400, error: 'Unsupported signature chain.' };
  }

  let signatureValid: boolean;
  try {
    signatureValid = await verifyWalletSignature({
      address,
      chainId,
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
  };
}
