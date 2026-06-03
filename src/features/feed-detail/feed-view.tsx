'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { type Address, isAddress } from 'viem';
import Header from '@/components/layout/header/Header';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import { useUsdEnrichedMarkets } from '@/hooks/useUsdEnrichedMarkets';
import { detectFeedVendorFromMetadata, OracleVendorIcons, PriceFeedVendors } from '@/utils/oracle';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { getNetworkName, isSupportedNetwork } from '@/utils/networks';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import {
  findFeedMarketDependencies,
  findFeedOccurrences,
  getFeedProviderLabel,
  getFeedTitle,
  getRepresentativeLeg,
  getUniqueOracleOccurrences,
  sortFeedMarketDependenciesByExposure,
  toFiniteNumber,
} from './feed-detail-utils';
import { useFeedContractDetails } from './hooks/use-feed-contract-details';
import { useFeedPriceHistory } from './hooks/use-feed-price-history';
import {
  ContractSection,
  EmptyRouteState,
  FeedHero,
  FeedInspectionSection,
  FeedMetadataSection,
  MarketsSection,
  OracleCoverageSection,
  VaultAccountingSection,
} from './components/feed-sections';
import { getFeedVendorIcon, isChainlinkFeedLeg } from './components/feed-shared';

function routeValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function FeedContent() {
  const params = useParams();
  const chainParam = routeValue(params.chainId);
  const addressParam = routeValue(params.address);
  const chainId = Number(chainParam);
  const routeAddress = addressParam ?? '';
  const feedAddress = isAddress(routeAddress) ? (routeAddress as Address) : null;
  const isRouteSupported = Number.isFinite(chainId) && isSupportedNetwork(chainId) && feedAddress != null;

  const {
    data: oracleMetadataMap,
    isLoading: oracleMetadataLoading,
    isError: oracleMetadataError,
  } = useOracleMetadata(isRouteSupported ? chainId : undefined);
  const { allMarkets, loading: marketsLoading } = useProcessedMarkets({
    marketsRefetchInterval: false,
    marketsRefetchOnWindowFocus: false,
    enableMorphoMetadata: false,
    enableUsdEnrichment: false,
  });

  const occurrences = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedOccurrences(oracleMetadataMap, feedAddress, chainId);
  }, [chainId, feedAddress, isRouteSupported, oracleMetadataMap]);

  const representativeLeg = useMemo(() => getRepresentativeLeg(occurrences), [occurrences]);
  const representativeOccurrence = useMemo(() => {
    if (!representativeLeg) return occurrences[0] ?? null;
    return occurrences.find((occurrence) => occurrence.leg === representativeLeg) ?? occurrences[0] ?? null;
  }, [occurrences, representativeLeg]);
  const dependencyKind = representativeOccurrence?.kind ?? null;
  const isVaultDependency = dependencyKind === 'vault';
  const isChainlinkFeed = isChainlinkFeedLeg(representativeLeg);

  const {
    latestRoundData,
    latestAnswer,
    latestTimestamp,
    feedDecimalsRaw,
    version,
    aggregatorAddress,
    ownerAddress,
    safeOwners,
    safeThreshold,
    showChainlinkContractDetails,
  } = useFeedContractDetails({
    feedAddress,
    chainId,
    isRouteSupported,
    isVaultDependency,
    isChainlinkFeed,
    oracleMetadataLoading,
  });

  const baseDependencies = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedMarketDependencies({
      markets: allMarkets,
      metadataRecord: oracleMetadataMap,
      feedAddress,
      chainId,
    });
  }, [allMarkets, chainId, feedAddress, isRouteSupported, oracleMetadataMap]);
  const dependencyMarkets = useMemo(() => baseDependencies.map(({ market }) => market), [baseDependencies]);
  const { markets: usdEnrichedDependencyMarkets, isLoading: isUsdEnrichmentLoading } = useUsdEnrichedMarkets(dependencyMarkets, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const dependencies = useMemo(() => {
    if (baseDependencies.length === 0) return baseDependencies;

    const enrichedMarketsByKey = new Map(
      usdEnrichedDependencyMarkets.map((market) => [getMarketIdentityKey(market.morphoBlue.chain.id, market.uniqueKey), market]),
    );

    return sortFeedMarketDependenciesByExposure(
      baseDependencies.map((dependency) => ({
        ...dependency,
        market:
          enrichedMarketsByKey.get(getMarketIdentityKey(dependency.market.morphoBlue.chain.id, dependency.market.uniqueKey)) ??
          dependency.market,
      })),
    );
  }, [baseDependencies, usdEnrichedDependencyMarkets]);

  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const feedTitle = feedAddress ? getFeedTitle(representativeLeg, feedAddress) : 'Feed';
  const feedDecimals = feedDecimalsRaw ?? representativeLeg?.decimals ?? null;
  const priceHistoryQuery = useFeedPriceHistory({
    address: feedAddress,
    chainId,
    decimals: feedDecimals,
    enabled: isRouteSupported && !oracleMetadataLoading && !isVaultDependency,
  });
  const totalSupplyUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.supplyAssetsUsd), 0);
  const totalBorrowUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.borrowAssetsUsd), 0);
  const uniqueOracleCount = getUniqueOracleOccurrences(occurrences).length;
  const isMetadataLoading = isRouteSupported && (oracleMetadataLoading || marketsLoading || isUsdEnrichmentLoading);

  if (!isRouteSupported) {
    return (
      <EmptyRouteState
        addressLabel={routeAddress}
        chainIdLabel={chainParam ?? ''}
      />
    );
  }

  const vendorResult =
    representativeLeg?.address && !representativeLeg.conversionSample
      ? detectFeedVendorFromMetadata(representativeLeg as EnrichedFeed)
      : null;
  const vendorIcon =
    vendorResult && vendorResult.vendor !== PriceFeedVendors.Unknown
      ? OracleVendorIcons[vendorResult.vendor]
      : getFeedVendorIcon(representativeLeg);

  return (
    <>
      <Header />
      <div className="container h-full pb-12 font-zen">
        <div className="mt-6 min-h-10">
          <Breadcrumbs
            items={[
              { label: 'Feeds', href: '/markets' },
              {
                label: (
                  <span className="inline-flex items-center gap-2 text-primary">
                    {vendorIcon && (
                      <Image
                        src={vendorIcon}
                        alt={getFeedProviderLabel(representativeLeg)}
                        width={14}
                        height={14}
                      />
                    )}
                    {feedTitle}
                  </span>
                ),
                isCurrent: true,
              },
            ]}
          />
        </div>

        <div className="mt-4 space-y-6">
          <FeedHero
            leg={representativeLeg}
            address={feedAddress}
            chainId={chainId}
            marketCount={dependencies.length}
            totalSupplyUsd={totalSupplyUsd}
            totalBorrowUsd={totalBorrowUsd}
            oracleCount={uniqueOracleCount}
            isStatsLoading={isMetadataLoading}
          />

          {oracleMetadataError && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-800 dark:text-yellow-200">
              Oracle metadata failed to load for {networkName}. Onchain reads may still work.
            </div>
          )}

          {!isMetadataLoading && !representativeLeg && (
            <div className="rounded border border-border bg-surface px-5 py-4 text-sm text-secondary shadow-sm">
              This feed was not found in the current oracle metadata. Contract reads and links are still shown.
            </div>
          )}

          {isVaultDependency ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.65fr)_minmax(24rem,1fr)]">
              <FeedMetadataSection
                leg={representativeLeg}
                chainId={chainId}
                kind={dependencyKind}
              />
              <VaultAccountingSection leg={representativeLeg} />
            </div>
          ) : (
            <FeedInspectionSection
              leg={representativeLeg}
              chainId={chainId}
              latestRoundData={latestRoundData}
              latestAnswer={latestAnswer}
              latestTimestamp={latestTimestamp}
              decimals={feedDecimals}
              priceHistory={priceHistoryQuery.data ?? []}
              isPriceHistoryLoading={priceHistoryQuery.isLoading || priceHistoryQuery.isFetching}
              isPriceHistoryError={priceHistoryQuery.isError}
            />
          )}

          {showChainlinkContractDetails && (
            <ContractSection
              chainId={chainId}
              aggregatorAddress={aggregatorAddress}
              ownerAddress={ownerAddress}
              version={version}
              safeOwners={safeOwners}
              safeThreshold={safeThreshold}
            />
          )}

          <OracleCoverageSection
            occurrences={occurrences}
            chainId={chainId}
          />

          <MarketsSection
            dependencies={dependencies}
            chainId={chainId}
          />
        </div>
      </div>
    </>
  );
}
