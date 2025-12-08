import { useMemo } from 'react';
import type { Address } from 'viem';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import type { CollateralAllocation, MarketAllocation } from '@/types/vaultAllocations';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { useAllocations } from './useAllocations';
import { useMarkets } from './useMarkets';

type UseVaultAllocationsArgs = {
  collateralCaps: VaultV2Cap[];
  marketCaps: VaultV2Cap[];
  vaultAddress: Address;
  chainId: SupportedNetworks;
  enabled?: boolean;
};

type UseVaultAllocationsReturn = {
  collateralAllocations: CollateralAllocation[];
  marketAllocations: MarketAllocation[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Hook that parses vault caps, filters valid ones, fetches allocations,
 * and returns typed allocation structures ready for components to consume.
 *
 * This hook:
 * 1. Parses raw cap data early in the data flow
 * 2. Enriches caps with token/market metadata
 * 3. Filters out unrecognized/invalid caps
 * 4. Fetches on-chain allocations only for valid caps
 * 5. Returns typed, ready-to-use allocation structures
 */
export function useVaultAllocations({
  collateralCaps,
  marketCaps,
  vaultAddress,
  chainId,
  enabled = true,
}: UseVaultAllocationsArgs): UseVaultAllocationsReturn {
  const { allMarkets } = useMarkets();

  // Parse and filter collateral caps
  const { validCollateralCaps, parsedCollateralCaps } = useMemo(() => {
    const valid: VaultV2Cap[] = [];
    const parsed: Omit<CollateralAllocation, 'allocation'>[] = [];

    collateralCaps.forEach((cap) => {
      const params = parseCapIdParams(cap.idParams);

      // Only include if we can parse the collateral token
      if (params.collateralToken) {
        const token = findToken(params.collateralToken, chainId);

        // Only include if we can find the token metadata
        if (token) {
          valid.push(cap);
          parsed.push({
            type: 'collateral',
            capId: cap.capId,
            collateralAddress: params.collateralToken,
            collateralSymbol: token.symbol,
            collateralDecimals: token.decimals,
            relativeCap: cap.relativeCap,
            absoluteCap: cap.absoluteCap,
          });
        }
      }
    });

    return { validCollateralCaps: valid, parsedCollateralCaps: parsed };
  }, [collateralCaps, chainId]);

  // Parse and filter market caps
  const { validMarketCaps, parsedMarketCaps } = useMemo(() => {
    const valid: VaultV2Cap[] = [];
    const parsed: Omit<MarketAllocation, 'allocation'>[] = [];

    marketCaps.forEach((cap) => {
      const params = parseCapIdParams(cap.idParams);

      // Only include if this is a market cap with a valid market ID
      if (params.type === 'market' && params.marketId) {
        const market = allMarkets.find((m) => m.uniqueKey.toLowerCase() === params.marketId?.toLowerCase());

        // Only include if we can find the market
        if (market) {
          valid.push(cap);
          parsed.push({
            type: 'market',
            capId: cap.capId,
            marketId: params.marketId,
            market,
            relativeCap: cap.relativeCap,
            absoluteCap: cap.absoluteCap,
          });
        }
      }
    });

    return { validMarketCaps: valid, parsedMarketCaps: parsed };
  }, [marketCaps, allMarkets]);

  // Combine all valid caps for fetching allocations
  const allValidCaps = useMemo(() => [...validCollateralCaps, ...validMarketCaps], [validCollateralCaps, validMarketCaps]);

  // Fetch allocations only for valid, recognized caps
  const { allocations, loading, error, refetch } = useAllocations({
    vaultAddress,
    chainId,
    caps: allValidCaps,
    enabled: enabled && allValidCaps.length > 0,
  });

  // Create allocation map for efficient lookup
  const allocationMap = useMemo(() => {
    const map = new Map<string, bigint>();
    allocations.forEach((a) => map.set(a.capId, a.allocation));
    return map;
  }, [allocations]);

  // Merge allocations with parsed collateral data
  const collateralAllocations = useMemo(
    () =>
      parsedCollateralCaps.map((cap) => ({
        ...cap,
        allocation: allocationMap.get(cap.capId) ?? 0n,
      })),
    [parsedCollateralCaps, allocationMap],
  );

  // Merge allocations with parsed market data
  const marketAllocations = useMemo(
    () =>
      parsedMarketCaps.map((cap) => ({
        ...cap,
        allocation: allocationMap.get(cap.capId) ?? 0n,
      })),
    [parsedMarketCaps, allocationMap],
  );

  return {
    collateralAllocations,
    marketAllocations,
    loading,
    error,
    refetch,
  };
}
