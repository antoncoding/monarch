'use client';

import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import type { Market } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import { BorrowModal } from './borrow-modal';

type BorrowModalGlobalProps = {
  market: Market;
  defaultMode?: 'borrow' | 'repay';
  toggleBorrowRepay?: boolean;
  refetch?: () => void;
  liquiditySourcing?: LiquiditySourcingResult;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global BorrowModal wrapper that fetches oracle price and user position automatically.
 * Used by the ModalRenderer via the modal registry.
 */
export function BorrowModalGlobal({
  market,
  defaultMode,
  toggleBorrowRepay,
  refetch: externalRefetch,
  liquiditySourcing,
  onOpenChange,
}: BorrowModalGlobalProps): JSX.Element {
  const { address } = useConnection();
  const chainId = market.morphoBlue.chain.id;

  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress,
    chainId,
  });

  const { position, refetch: refetchPosition } = useUserPosition(address, chainId, market.uniqueKey);

  const handleRefetch = useCallback(() => {
    refetchPosition();
    externalRefetch?.();
  }, [refetchPosition, externalRefetch]);

  return (
    <BorrowModal
      market={market}
      onOpenChange={onOpenChange}
      oraclePrice={oraclePrice}
      refetch={handleRefetch}
      position={position}
      defaultMode={defaultMode}
      toggleBorrowRepay={toggleBorrowRepay}
      liquiditySourcing={liquiditySourcing}
    />
  );
}
