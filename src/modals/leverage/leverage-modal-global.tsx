'use client';

import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { LeverageModal } from './leverage-modal';

type LeverageModalGlobalProps = {
  market: Market;
  defaultMode?: 'leverage' | 'deleverage';
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
  defaultMode,
  toggleLeverageDeleverage,
  refetch: externalRefetch,
  onOpenChange,
}: LeverageModalGlobalProps): JSX.Element {
  const { address } = useConnection();
  const chainId = market.morphoBlue.chain.id as SupportedNetworks;

  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress as `0x${string}`,
    chainId,
  });

  const { position, refetch: refetchPosition } = useUserPosition(address, chainId, market.uniqueKey);

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
      position={position}
      defaultMode={defaultMode}
      toggleLeverageDeleverage={toggleLeverageDeleverage}
    />
  );
}
