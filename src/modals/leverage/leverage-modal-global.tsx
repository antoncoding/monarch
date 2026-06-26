'use client';

import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import { hasBorrowSidePosition } from '@/utils/positions';
import type { Market, MarketPosition } from '@/utils/types';
import { LeverageModal } from './leverage-modal';

type LeverageModalGlobalProps = {
  market: Market;
  position?: MarketPosition | null;
  intent?: 'create' | 'adjust';
  refetch?: () => void;
  onOpenChange: (open: boolean) => void;
};

function isMatchingPosition(candidate: MarketPosition | null | undefined, market: Market, chainId: number): boolean {
  return candidate?.market.uniqueKey.toLowerCase() === market.uniqueKey.toLowerCase() && candidate.market.morphoBlue.chain.id === chainId;
}

/**
 * Global wrapper that mirrors BorrowModalGlobal behavior:
 * it resolves oracle price + user position before rendering the leverage modal.
 */
export function LeverageModalGlobal({
  market,
  position: providedPosition,
  intent,
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
  // Prefer the live position, but keep the row-seeded position when fallback APIs return null.
  const resolvedPosition: MarketPosition | null = isMatchingPosition(position, market, chainId)
    ? (position ?? null)
    : isMatchingPosition(providedPosition, market, chainId)
      ? (providedPosition ?? null)
      : null;
  const resolvedIntent = intent ?? (hasBorrowSidePosition(resolvedPosition) ? 'adjust' : 'create');

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
      intent={resolvedIntent}
    />
  );
}
