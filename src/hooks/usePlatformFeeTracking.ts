import { useCallback } from 'react';
import { useConnection } from 'wagmi';

export interface PlatformFeeEventInput {
  source: string;
  tokenAddress: string;
  amountRaw: string;
  userWallet?: string;
}

interface TrackPlatformFeeEventsParams {
  chainId: number;
  txHash: string;
  events: PlatformFeeEventInput[];
}

export function usePlatformFeeTracking() {
  const { address } = useConnection();

  const trackPlatformFeeEvents = useCallback(
    async ({ chainId, txHash, events }: TrackPlatformFeeEventsParams) => {
      await Promise.allSettled(
        events
          .filter((event) => event.amountRaw !== '0')
          .map((event) => {
            const userWallet = event.userWallet ?? address;
            if (!userWallet) return Promise.resolve();

            return fetch('/api/platform-fees', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userWallet,
                chainId,
                txHash,
                source: event.source,
                tokenAddress: event.tokenAddress,
                amountRaw: event.amountRaw,
              }),
            });
          }),
      );
    },
    [address],
  );

  return { trackPlatformFeeEvents };
}
