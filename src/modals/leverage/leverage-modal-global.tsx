'use client';

import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import type { Market, MarketPosition } from '@/utils/types';
import { LeverageModal } from './leverage-modal';

type LeverageModalGlobalProps = {
  market: Market;
  position?: MarketPosition | null;
  defaultMode?: 'leverage' | 'deleverage';
  defaultLeverageSource?: 'wallet' | 'position';
  toggleLeverageDeleverage?: boolean;
  refetch?: () => void;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global wrapper that mirrors BorrowModalGlobal behavior:
 * it resolves oracle price + user position before rendering the leverage modal.
 */
export function LeverageModalGlobal({
  market,
  position: providedPosition,
  defaultMode,
  defaultLeverageSource,
  toggleLeverageDeleverage,
  refetch: externalRefetch,
  onOpenChange,
}: LeverageModalGlobalProps): JSX.Element {
  const { address } = useConnection();
  const chainId = market.morphoBlue.chain.id;

  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress as `0x${string}`,
    chainId,
  });

  const { position, refetch: refetchPosition } = useUserPosition(address, chainId, market.uniqueKey);
  const resolvedPosition = providedPosition ?? position;

  const handleRefetch = useCallback(() => {
    refetchPosition();
    externalRefetch?.();
  }, [refetchPosition, externalRefetch]);

  return (
    <LeverageModal
      market={market}
      onOpenChange={onOpenChange}
      oraclePrice={oraclePrice}
      refetch={handleRefetch}
      position={resolvedPosition}
      defaultMode={defaultMode}
      defaultLeverageSource={defaultLeverageSource}
      toggleLeverageDeleverage={toggleLeverageDeleverage}
    />
  );
}
