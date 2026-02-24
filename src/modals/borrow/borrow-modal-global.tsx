'use client';

import { useConnection } from 'wagmi';
import type { Market } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import type { SupportedNetworks } from '@/utils/networks';
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
  const chainId = market.morphoBlue.chain.id as SupportedNetworks;

  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress as `0x${string}`,
    chainId,
  });

  const { position, refetch: refetchPosition } = useUserPosition(address, chainId, market.uniqueKey);

  const handleRefetch = () => {
    refetchPosition();
    externalRefetch?.();
  };

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
