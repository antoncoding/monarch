import { useMemo, useCallback } from 'react';
import { MarketWithSelection } from '@/components/common/MarketsTable/MarketTableRow';
import { useTokens } from '@/components/providers/TokenProvider';
import { useMarkets } from '@/hooks/useMarkets';
import {
  SortColumn,
  useMarketTableStore,
  useTableFilters,
  useTableSorting,
  useTableUsdFilters,
  useTableTrustedVaults,
} from '@/store/marketTableStore';
import { filterMarkets, sortMarkets, createPropertySort } from '@/utils/marketFilters';
import { hasTrustedVault } from '@/utils/marketTableHelpers';
import { getViemChain } from '@/utils/networks';
import { parsePriceFeedVendors, PriceFeedVendors } from '@/utils/oracle';
import { ERC20Token, UnknownERC20Token, infoToKey } from '@/utils/tokens';
import { buildTrustedVaultMap } from '@/utils/vaults';

/**
 * Hook to get available collateral tokens from markets
 */
export function useAvailableCollaterals(
  markets: MarketWithSelection[],
  uniqueCollateralTokens?: (ERC20Token | UnknownERC20Token)[],
) {
  const { findToken } = useTokens();

  return useMemo(() => {
    if (uniqueCollateralTokens) {
      return [...uniqueCollateralTokens].sort(
        (a, b) =>
          (a.source === 'local' ? 0 : 1) - (b.source === 'local' ? 0 : 1) ||
          a.symbol.localeCompare(b.symbol),
      );
    }

    // Fallback: build tokens manually from markets
    const tokenMap = new Map<string, ERC20Token | UnknownERC20Token>();

    markets.forEach((m) => {
      // Add null checks for nested properties
      if (!m?.market?.collateralAsset?.address || !m?.market?.morphoBlue?.chain?.id) {
        return;
      }

      const key = infoToKey(m.market.collateralAsset.address, m.market.morphoBlue.chain.id);

      if (!tokenMap.has(key)) {
        // Check if token exists in supportedTokens
        const existingToken = findToken(m.market.collateralAsset.address, m.market.morphoBlue.chain.id);

        if (existingToken) {
          tokenMap.set(key, existingToken);
        } else {
          const token: UnknownERC20Token = {
            symbol: m.market.collateralAsset.symbol ?? 'Unknown',
            img: undefined,
            decimals: m.market.collateralAsset.decimals ?? 18,
            networks: [
              {
                address: m.market.collateralAsset.address,
                chain: getViemChain(m.market.morphoBlue.chain.id),
              },
            ],
            isUnknown: true,
            source: 'unknown',
          };
          tokenMap.set(key, token);
        }
      }
    });

    return Array.from(tokenMap.values()).sort(
      (a, b) =>
        (a.source === 'local' ? 0 : 1) - (b.source === 'local' ? 0 : 1) ||
        a.symbol.localeCompare(b.symbol),
    );
  }, [markets, uniqueCollateralTokens, findToken]);
}

/**
 * Hook to get available oracle vendors from markets
 */
export function useAvailableOracles(markets: MarketWithSelection[]) {
  return useMemo(() => {
    const oracleSet = new Set<PriceFeedVendors>();

    markets.forEach((m) => {
      if (!m?.market?.morphoBlue?.chain?.id) return;
      const vendorInfo = parsePriceFeedVendors(m.market.oracle?.data, m.market.morphoBlue.chain.id);
      if (vendorInfo?.coreVendors) {
        vendorInfo.coreVendors.forEach((vendor) => oracleSet.add(vendor));
      }
    });

    return Array.from(oracleSet);
  }, [markets]);
}

/**
 * Hook to process markets with filtering and sorting
 */
export function useProcessedMarkets(markets: MarketWithSelection[]) {
  const { showUnwhitelistedMarkets } = useMarkets();
  const { findToken } = useTokens();

  const {
    collateralFilter,
    oracleFilter,
    searchQuery,
    includeUnknownTokens,
    showUnknownOracle,
    trustedVaultsOnly,
  } = useTableFilters();

  const {
    usdMinSupply,
    usdMinBorrow,
    usdMinLiquidity,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
  } = useTableUsdFilters();

  const { sortColumn, sortDirection } = useTableSorting();
  const { userTrustedVaults } = useTableTrustedVaults();

  const trustedVaultMap = useMemo(() => {
    return buildTrustedVaultMap(userTrustedVaults);
  }, [userTrustedVaults]);

  const hasTrustedVaultCallback = useCallback(
    (market: MarketWithSelection['market']) => {
      return hasTrustedVault(market, trustedVaultMap);
    },
    [trustedVaultMap],
  );

  return useMemo(() => {
    // Extract just the markets for filtering
    const marketsList = markets.map((m) => m.market);

    // Apply global filters using the shared utility
    let filtered = filterMarkets(marketsList, {
      showUnknownTokens: includeUnknownTokens,
      showUnknownOracle,
      selectedCollaterals: collateralFilter,
      selectedOracles: oracleFilter,
      usdFilters: {
        minSupply: { enabled: minSupplyEnabled, threshold: usdMinSupply },
        minBorrow: { enabled: minBorrowEnabled, threshold: usdMinBorrow },
        minLiquidity: { enabled: minLiquidityEnabled, threshold: usdMinLiquidity },
      },
      findToken,
      searchQuery,
    });

    // Apply whitelist filter (not in the shared utility because it uses global state)
    if (!showUnwhitelistedMarkets) {
      filtered = filtered.filter((market) => market.whitelisted ?? false);
    }

    if (trustedVaultsOnly) {
      filtered = filtered.filter(hasTrustedVaultCallback);
    }

    // Sort using the shared utility
    const sortPropertyMap: Record<SortColumn, string> = {
      [SortColumn.COLLATSYMBOL]: 'collateralAsset.symbol',
      [SortColumn.Supply]: 'state.supplyAssetsUsd',
      [SortColumn.APY]: 'state.supplyApy',
      [SortColumn.Liquidity]: 'state.liquidityAssets',
      [SortColumn.Borrow]: 'state.borrowAssetsUsd',
      [SortColumn.BorrowAPY]: 'state.borrowApy',
      [SortColumn.RateAtTarget]: 'state.apyAtTarget',
      [SortColumn.Risk]: '', // No sorting for risk
      [SortColumn.TrustedBy]: '',
    };

    const propertyPath = sortPropertyMap[sortColumn];
    if (sortColumn === SortColumn.TrustedBy) {
      filtered = sortMarkets(
        filtered,
        (a, b) => Number(hasTrustedVaultCallback(a)) - Number(hasTrustedVaultCallback(b)),
        sortDirection,
      );
    } else if (propertyPath && sortColumn !== SortColumn.Risk) {
      filtered = sortMarkets(filtered, createPropertySort(propertyPath), sortDirection);
    }

    // Map back to MarketWithSelection
    return filtered.map((market) => {
      const original = markets.find((m) => m.market.uniqueKey === market.uniqueKey);
      return original ?? { market, isSelected: false };
    });
  }, [
    markets,
    collateralFilter,
    oracleFilter,
    sortColumn,
    sortDirection,
    searchQuery,
    showUnwhitelistedMarkets,
    includeUnknownTokens,
    showUnknownOracle,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
    usdMinSupply,
    usdMinBorrow,
    usdMinLiquidity,
    findToken,
    hasTrustedVaultCallback,
    trustedVaultsOnly,
  ]);
}

/**
 * Hook to get paginated markets
 */
export function usePaginatedMarkets(processedMarkets: MarketWithSelection[]) {
  const currentPage = useMarketTableStore((state) => state.currentPage);
  const entriesPerPage = useMarketTableStore((state) => state.entriesPerPage);

  return useMemo(() => {
    const safePerPage = Math.max(1, Math.floor(entriesPerPage));
    const totalPages = Math.max(1, Math.ceil(processedMarkets.length / safePerPage));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * safePerPage;

    return {
      paginatedMarkets: processedMarkets.slice(startIndex, startIndex + safePerPage),
      totalPages,
      safePage,
      safePerPage,
    };
  }, [processedMarkets, currentPage, entriesPerPage]);
}
