import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { getStoredReferralCode } from '@/utils/referrals';

interface TrackReferralAttributionParams {
  chainId: number;
  txHash: string;
}

export function useReferralAttributionTracking() {
  const { address } = useConnection();

  const trackReferralAttribution = useCallback(
    async ({ chainId, txHash }: TrackReferralAttributionParams) => {
      const referralCode = getStoredReferralCode();
      if (!address || !referralCode) return;

      await fetch('/api/referrals/attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referredWallet: address,
          referralCode,
          chainId,
          txHash,
        }),
      });
    },
    [address],
  );

  return { trackReferralAttribution };
}
