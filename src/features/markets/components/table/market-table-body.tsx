import React, { useMemo } from 'react';
import { GoStarFill, GoStar } from 'react-icons/go';
import { PulseLoader } from 'react-spinners';
import { useConnection } from 'wagmi';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIndicators } from '@/features/markets/components/market-indicators';
import { MarketRiskIndicators } from '@/features/markets/components/market-risk-indicators';
import OracleVendorBadge from '@/features/markets/components/oracle-vendor-badge';
import { TrustedByCell } from '@/features/autovault/components/trusted-vault-badges';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import type { MarketV2SupplyingVault } from '@/data-sources/monarch-api/vaults';
import type { MarketDiscoveryCategory } from '@/features/markets/market-discovery';
import { isMarketDiscoveryEligible } from '@/features/markets/market-discovery';
import { useMarketDiscoveryFlagsMap } from '@/hooks/queries/useMarketDiscoveryFlagsQuery';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useMarketFilterPreferences } from '@/stores/useMarketFilterPreferences';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { getMetricsKey, useMarketMetricsMap } from '@/hooks/queries/useMarketMetricsQuery';
import type { MarketRateEnrichment } from '@/utils/market-rate-enrichment';
import useUserPositions from '@/hooks/useUserPositions';
import { getMarketIdentityKey } from '@/utils/market-identity';
import type { SupportedNetworks } from '@/utils/networks';
import { hasBorrowSidePosition } from '@/utils/positions';
import type { Market } from '@/utils/types';
import { getTrustedVaultsForMarket } from '@/utils/vaults';
import { cn } from '@/utils/components';
import { APYCell } from '../apy-breakdown-tooltip';
import { MarketActionsDropdown } from '../market-actions-dropdown';
import { ExpandedMarketDetail } from './market-row-detail';
import { TDAsset, TDTotalSupplyOrBorrow } from './market-table-utils';

type MarketTableBodyProps = {
  currentEntries: Market[];
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  trustedVaultMap: Map<string, TrustedVault>;
  v2SupplyingVaultsLookup: Map<string, MarketV2SupplyingVault[]>;
  rateEnrichmentPendingChainIds: Set<number>;
  rateEnrichmentLoading: boolean;
};

type HistoricalRateField = Exclude<keyof MarketRateEnrichment, 'apyAtTarget' | 'rateAtTarget'>;

export function MarketTableBody({
  currentEntries,
  expandedRowId,
  setExpandedRowId,
  trustedVaultMap,
  v2SupplyingVaultsLookup,
  rateEnrichmentPendingChainIds,
  rateEnrichmentLoading,
}: MarketTableBodyProps) {
  const { columnVisibility, starredMarkets, starMarket, unstarMarket } = useMarketPreferences();
  const discoveryCategories = useMarketFilterPreferences((state) => state.discoveryCategories);
  const { success: toastSuccess } = useStyledToast();
  const { address } = useConnection();
  const { metricsMap } = useMarketMetricsMap({
    enabled: currentEntries.length > 0,
  });
  const {
    flagsByMarket,
    categoriesByMarket,
    data: discoveryFlagsResponse,
  } = useMarketDiscoveryFlagsMap({
    enabled: currentEntries.length > 0,
    defer: true,
  });
  const discoveryDataLoaded = Boolean(discoveryFlagsResponse?.flags);
  const activeDiscoveryCategories = useMemo(() => new Set<MarketDiscoveryCategory>(discoveryCategories), [discoveryCategories]);

  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });
  const currentChainIds = useMemo(
    () => Array.from(new Set(currentEntries.map((market) => market.morphoBlue.chain.id as SupportedNetworks))),
    [currentEntries],
  );
  const { data: userPositions } = useUserPositions(address, false, currentChainIds);
  const borrowPositionByMarket = useMemo(() => {
    const nextMap = new Map<string, boolean>();
    for (const position of userPositions) {
      if (hasBorrowSidePosition(position)) {
        nextMap.set(getMarketIdentityKey(position.market.morphoBlue.chain.id, position.market.uniqueKey), true);
      }
    }
    return nextMap;
  }, [userPositions]);

  const renderRateLoading = () => (
    <PulseLoader
      size={4}
      color="#f45f2d"
      margin={3}
    />
  );

  const shouldShowRateLoader = (market: Market) => rateEnrichmentLoading || rateEnrichmentPendingChainIds.has(market.morphoBlue.chain.id);

  const renderHistoricalRateCell = (market: Market, field: HistoricalRateField) => {
    const value = market.state[field];
    if (value != null) {
      return <RateFormatted value={value} />;
    }

    if (shouldShowRateLoader(market)) {
      return renderRateLoading();
    }

    return '—';
  };

  // Calculate colspan for expanded row based on visible columns
  const visibleColumnsCount =
    9 + // Base columns: Star, ID, Loan, Collateral, Oracle, LLTV, Risk, Indicators, Actions
    (columnVisibility.totalSupply ? 1 : 0) +
    (columnVisibility.totalBorrow ? 1 : 0) +
    (columnVisibility.liquidity ? 1 : 0) +
    (columnVisibility.supplyAPY ? 1 : 0) +
    (columnVisibility.borrowAPY ? 1 : 0) +
    (columnVisibility.rateAtTarget ? 1 : 0) +
    (columnVisibility.trustedBy ? 1 : 0) +
    (columnVisibility.utilizationRate ? 1 : 0) +
    (columnVisibility.dailySupplyAPY ? 1 : 0) +
    (columnVisibility.dailyBorrowAPY ? 1 : 0) +
    (columnVisibility.weeklySupplyAPY ? 1 : 0) +
    (columnVisibility.weeklyBorrowAPY ? 1 : 0) +
    (columnVisibility.monthlySupplyAPY ? 1 : 0) +
    (columnVisibility.monthlyBorrowAPY ? 1 : 0);

  return (
    <TableBody className="text-sm">
      {currentEntries.map((item) => {
        const collatToShow = item.collateralAsset.symbol.slice(0, 6).concat(item.collateralAsset.symbol.length > 6 ? '...' : '');
        const isStared = starredMarkets.includes(item.uniqueKey);
        const marketKey = getMetricsKey(item.morphoBlue.chain.id, item.uniqueKey);
        const metrics = metricsMap.get(marketKey);
        const isDiscoveryEligible = isMarketDiscoveryEligible(item);
        const discoveryFlags = isDiscoveryEligible ? (flagsByMarket.get(marketKey) ?? []) : [];
        const marketDiscoveryCategories = isDiscoveryEligible ? categoriesByMarket.get(marketKey) : undefined;
        const resolvedDiscoveryCategories = discoveryDataLoaded
          ? (marketDiscoveryCategories ?? new Set<MarketDiscoveryCategory>())
          : marketDiscoveryCategories;
        const activeMarketDiscoveryCategories = new Set<MarketDiscoveryCategory>();
        if (marketDiscoveryCategories && activeDiscoveryCategories.size > 0) {
          for (const category of marketDiscoveryCategories) {
            if (activeDiscoveryCategories.has(category)) {
              activeMarketDiscoveryCategories.add(category);
            }
          }
        }
        const isDiscoveryFocused = activeMarketDiscoveryCategories.size > 0;

        return (
          <React.Fragment key={item.uniqueKey}>
            <TableRow
              onClick={() => {
                setExpandedRowId(item.uniqueKey === expandedRowId ? null : item.uniqueKey);
              }}
              className={cn(
                'hover:cursor-pointer',
                item.uniqueKey === expandedRowId && 'table-body-focused',
                isDiscoveryFocused && 'market-discovery-focused',
              )}
            >
              <TableCell
                data-label=""
                className="z-50"
                style={{ minWidth: '40px' }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isStared) {
                      unstarMarket(item.uniqueKey);
                      toastSuccess('Market unstarred', 'Removed from favorites');
                    } else {
                      starMarket(item.uniqueKey);
                      toastSuccess('Market starred', 'Added to favorites');
                    }
                  }}
                >
                  <p className="text-lg text-orange-500 group-hover:opacity-100">
                    {isStared ? <GoStarFill size={15} /> : <GoStar size={15} />}
                  </p>
                </button>
              </TableCell>
              <TableCell
                data-label="ID"
                className="z-50"
                style={{ minWidth: '80px' }}
              >
                <MarketIdBadge
                  marketId={item.uniqueKey}
                  chainId={item.morphoBlue.chain.id}
                  showNetworkIcon
                />
              </TableCell>
              <TDAsset
                dataLabel="Loan"
                asset={item.loanAsset.address}
                chainId={item.morphoBlue.chain.id}
                symbol={item.loanAsset.symbol}
              />
              <TDAsset
                dataLabel="Collateral"
                asset={item.collateralAsset.address}
                chainId={item.morphoBlue.chain.id}
                symbol={collatToShow}
              />
              <TableCell
                data-label="Oracle"
                className="z-50"
                style={{ minWidth: '90px' }}
              >
                <div className="flex justify-center">
                  <OracleVendorBadge
                    oracleAddress={item.oracleAddress}
                    chainId={item.morphoBlue.chain.id}
                  />
                </div>
              </TableCell>
              <TableCell
                data-label="LLTV"
                className="z-50"
                style={{ minWidth: '60px', padding: 5 }}
              >
                {Number(item.lltv) / 1e16}%
              </TableCell>
              {columnVisibility.trustedBy && (
                <TableCell
                  data-label="Trusted By"
                  className="z-50 text-center"
                  style={{ minWidth: '110px', paddingLeft: 6, paddingRight: 6 }}
                >
                  <TrustedByCell vaults={getTrustedVaultsForMarket(item, trustedVaultMap, v2SupplyingVaultsLookup)} />
                </TableCell>
              )}
              {columnVisibility.totalSupply && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Total Supply"
                  assetsUSD={item.state.supplyAssetsUsd}
                  assets={item.state.supplyAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                  isEstimated={!item.hasUSDPrice}
                />
              )}
              {columnVisibility.totalBorrow && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Total Borrow"
                  assetsUSD={item.state.borrowAssetsUsd}
                  assets={item.state.borrowAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                  isEstimated={!item.hasUSDPrice}
                />
              )}
              {columnVisibility.liquidity && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Liquidity"
                  assetsUSD={item.state.liquidityAssetsUsd}
                  assets={item.state.liquidityAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                  isEstimated={!item.hasUSDPrice}
                />
              )}
              {columnVisibility.supplyAPY && (
                <TableCell
                  data-label={supplyRateLabel}
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <APYCell market={item} />
                </TableCell>
              )}
              {columnVisibility.borrowAPY && (
                <TableCell
                  data-label={borrowRateLabel}
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <p className="text-sm">
                    {item.state.borrowApy == null ? (
                      '—'
                    ) : (
                      <APYCell
                        market={item}
                        mode="borrow"
                      />
                    )}
                  </p>
                </TableCell>
              )}
              {columnVisibility.rateAtTarget && (
                <TableCell
                  data-label="Target Rate"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">
                    {item.state.apyAtTarget == null ? (
                      shouldShowRateLoader(item) ? (
                        renderRateLoading()
                      ) : (
                        '—'
                      )
                    ) : (
                      <RateFormatted value={item.state.apyAtTarget} />
                    )}
                  </div>
                </TableCell>
              )}
              {columnVisibility.utilizationRate && (
                <TableCell
                  data-label="Utilization"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <p className="text-sm">{`${(item.state.utilization * 100).toFixed(2)}%`}</p>
                </TableCell>
              )}
              {columnVisibility.dailySupplyAPY && (
                <TableCell
                  data-label="24h Supply"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'dailySupplyApy')}</div>
                </TableCell>
              )}
              {columnVisibility.dailyBorrowAPY && (
                <TableCell
                  data-label="24h Borrow"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'dailyBorrowApy')}</div>
                </TableCell>
              )}
              {columnVisibility.weeklySupplyAPY && (
                <TableCell
                  data-label="7d Supply"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'weeklySupplyApy')}</div>
                </TableCell>
              )}
              {columnVisibility.weeklyBorrowAPY && (
                <TableCell
                  data-label="7d Borrow"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'weeklyBorrowApy')}</div>
                </TableCell>
              )}
              {columnVisibility.monthlySupplyAPY && (
                <TableCell
                  data-label="30d Supply"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'monthlySupplyApy')}</div>
                </TableCell>
              )}
              {columnVisibility.monthlyBorrowAPY && (
                <TableCell
                  data-label="30d Borrow"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <div className="flex justify-center text-sm">{renderHistoricalRateCell(item, 'monthlyBorrowApy')}</div>
                </TableCell>
              )}
              <TableCell style={{ minWidth: '90px' }}>
                <MarketRiskIndicators
                  market={item}
                  marketMetrics={metrics ?? null}
                />
              </TableCell>
              <TableCell
                data-label="Indicators"
                className="z-50"
                style={{ maxWidth: '40px', padding: 0 }}
              >
                <MarketIndicators
                  market={item}
                  marketMetrics={metrics ?? null}
                  discoveryFlags={discoveryFlags}
                  discoveryCategories={resolvedDiscoveryCategories}
                  discoveryDataLoaded={discoveryDataLoaded}
                  showRisk={false}
                />
              </TableCell>
              <TableCell
                data-label="Actions"
                className="justify-center px-4 py-3"
              >
                <div className="flex items-center justify-center">
                  <MarketActionsDropdown
                    market={item}
                    hasBorrowPosition={borrowPositionByMarket.get(getMarketIdentityKey(item.morphoBlue.chain.id, item.uniqueKey)) ?? false}
                  />
                </div>
              </TableCell>
            </TableRow>
            {expandedRowId === item.uniqueKey && (
              <TableRow className="table-body-focused">
                <TableCell
                  className="collaps-viewer bg-hovered p-0"
                  colSpan={visibleColumnsCount}
                >
                  <div className="p-4">
                    <ExpandedMarketDetail
                      market={item}
                      marketMetrics={metrics ?? null}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        );
      })}
    </TableBody>
  );
}
