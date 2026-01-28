'use client';

import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import { BorrowModal } from './borrow-modal';

type BorrowModalGlobalProps = {
  market: Market;
  position?: MarketPosition | null;
  defaultMode?: 'borrow' | 'repay';
  isMarketPage?: boolean;
  refetch?: () => void;
  liquiditySourcing?: LiquiditySourcingResult;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global BorrowModal wrapper that fetches oracle price automatically.
 * Used by the ModalRenderer via the modal registry.
 */
export function BorrowModalGlobal({
  market,
  position,
  defaultMode,
  refetch,
  liquiditySourcing,
  onOpenChange,
}: BorrowModalGlobalProps): JSX.Element {
  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress as `0x${string}`,
    chainId: market.morphoBlue.chain.id,
  });

  return (
    <BorrowModal
      market={market}
      onOpenChange={onOpenChange}
      oraclePrice={oraclePrice}
      refetch={refetch}
      position={position ?? null}
      defaultMode={defaultMode}
      liquiditySourcing={liquiditySourcing}
    />
  );
}
