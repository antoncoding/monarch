import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMonarchMarket } from '@/data-sources/monarch-api';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import type { CollateralAllocation, MarketAllocation } from '@/types/vaultAllocations';
import type { VaultV2Cap } from '@/data-sources/monarch-api/vaults';
import { supportsMorphoApi } from '@/config/dataSources';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { useAllocationsQuery } from './queries/useAllocations';
import { useVaultV2Data } from './useVaultV2Data';

type UseVaultAllocationsArgs = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  enabled?: boolean;
  includeCollateralAllocations?: boolean;
};

type UseVaultAllocationsReturn = {
  collateralAllocations: CollateralAllocation[];
  marketAllocations: MarketAllocation[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

const EMPTY_MARKET_MAP = new Map<string, Market>();

const fetchVaultCapMarket = async (
  marketId: string,
  chainId: SupportedNetworks,
  customRpcUrls: Partial<Record<SupportedNetworks, string>>,
): Promise<Market | null> => {
  try {
    const monarchMarket = await fetchMonarchMarket(marketId, chainId, customRpcUrls);
    if (monarchMarket) return monarchMarket;
  } catch (error) {
    console.warn(`[VaultAllocations] Failed to fetch Monarch market ${marketId} on ${chainId}:`, error);
  }

  if (supportsMorphoApi(chainId)) {
    try {
      const morphoMarket = await fetchMorphoMarket(marketId, chainId);
      if (morphoMarket) return morphoMarket;
    } catch (error) {
      console.warn(`[VaultAllocations] Failed to fetch Morpho market ${marketId} on ${chainId}:`, error);
    }
  }

  try {
    return await fetchSubgraphMarket(marketId, chainId);
  } catch (error) {
    console.warn(`[VaultAllocations] Failed to fetch Subgraph market ${marketId} on ${chainId}:`, error);
    return null;
  }
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
  vaultAddress,
  chainId,
  enabled = true,
  includeCollateralAllocations = false,
}: UseVaultAllocationsArgs): UseVaultAllocationsReturn {
  const { customRpcUrls } = useCustomRpcContext();
  const rpcIdentity = useMemo(() => Object.entries(customRpcUrls).sort(([left], [right]) => Number(left) - Number(right)), [customRpcUrls]);

  // Pull vault data directly - TanStack Query handles deduplication
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });

  const collateralCaps = vaultData?.capsData?.collateralCaps ?? [];
  const marketCaps = vaultData?.capsData?.marketCaps ?? [];

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

  const marketCapEntries = useMemo(() => {
    const entries: { cap: VaultV2Cap; marketId: string }[] = [];

    for (const cap of marketCaps) {
      const params = parseCapIdParams(cap.idParams);
      if (params.type === 'market' && params.marketId) {
        entries.push({ cap, marketId: params.marketId });
      }
    }

    return entries;
  }, [marketCaps]);

  const marketIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];

    for (const entry of marketCapEntries) {
      const normalizedId = entry.marketId.toLowerCase();
      if (seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      ids.push(entry.marketId);
    }

    return ids;
  }, [marketCapEntries]);

  const marketIdsKey = useMemo(() => marketIds.map((marketId) => marketId.toLowerCase()).sort().join(','), [marketIds]);

  const {
    data: capMarketsById = EMPTY_MARKET_MAP,
    isLoading: capMarketsLoading,
    error: capMarketsError,
    refetch: refetchCapMarkets,
  } = useQuery({
    queryKey: ['vault-cap-markets', vaultAddress.toLowerCase(), chainId, marketIdsKey, rpcIdentity],
    queryFn: async () => {
      const results = await Promise.allSettled(
        marketIds.map(async (marketId) => ({
          marketId,
          market: await fetchVaultCapMarket(marketId, chainId, customRpcUrls),
        })),
      );
      const nextMarkets = new Map<string, Market>();
      const unresolvedMarketIds: string[] = [];

      for (const [index, result] of results.entries()) {
        if (result.status !== 'fulfilled') {
          unresolvedMarketIds.push(marketIds[index] ?? `index:${index}`);
          continue;
        }

        if (!result.value.market) {
          unresolvedMarketIds.push(result.value.marketId);
          continue;
        }

        nextMarkets.set(result.value.marketId.toLowerCase(), result.value.market);
      }

      if (unresolvedMarketIds.length > 0) {
        throw new Error(`Failed to resolve vault cap markets: ${unresolvedMarketIds.join(', ')}`);
      }

      return nextMarkets;
    },
    enabled: enabled && marketIds.length > 0,
    staleTime: 30_000,
  });

  // Parse and filter market caps
  const { validMarketCaps, parsedMarketCaps } = useMemo(() => {
    const valid: VaultV2Cap[] = [];
    const parsed: Omit<MarketAllocation, 'allocation'>[] = [];

    for (const { cap, marketId } of marketCapEntries) {
      const market = capMarketsById.get(marketId.toLowerCase());

      // Only include if we can find the market
      if (market) {
        valid.push(cap);
        parsed.push({
          type: 'market',
          capId: cap.capId,
          marketId,
          market,
          relativeCap: cap.relativeCap,
          absoluteCap: cap.absoluteCap,
        });
      }
    }

    return { validMarketCaps: valid, parsedMarketCaps: parsed };
  }, [capMarketsById, marketCapEntries]);

  // Combine all valid caps for fetching allocations
  const allValidCaps = useMemo(
    () => [...(includeCollateralAllocations ? validCollateralCaps : []), ...validMarketCaps],
    [includeCollateralAllocations, validCollateralCaps, validMarketCaps],
  );

  // Fetch allocations only for valid, recognized caps
  const {
    allocations,
    isLoading: allocationsLoading,
    error,
    refetch,
  } = useAllocationsQuery({
    vaultAddress,
    chainId,
    caps: allValidCaps,
    enabled: enabled && allValidCaps.length > 0,
  });

  // Loading if any dependency is loading
  const loading = vaultDataLoading || capMarketsLoading || allocationsLoading;

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
    error: capMarketsError ?? error,
    refetch: () => {
      void refetchCapMarkets();
      void refetch();
    },
  };
}
