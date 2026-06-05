import { useState } from 'react';
import Image from 'next/image';
import type { Address } from 'viem';
import Header from '@/components/layout/header/Header';
import { AddressIdentity } from '@/components/shared/address-identity';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { TablePagination } from '@/components/shared/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { FeedTypeBadge } from '@/features/markets/components/oracle/MarketOracle/FeedTypeBadge';
import { formatOracleDuration, formatOraclePrice, isMonarchVerifiedFeed } from '@/utils/oracle';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { MARKETS_PAGE_SIZE, ORACLE_CONTRACTS_PAGE_SIZE } from '../feed-detail-constants';
import { formatOptionalTimestamp, formatScannerTimestamp } from '../feed-detail-formatters';
import {
  formatPercentValue,
  formatUsdCompact,
  getFeedTitle,
  getUniqueOracleOccurrences,
  type FeedDependencyLeg,
  type FeedDependencyOccurrence,
  type FeedMarketDependency,
} from '../feed-detail-utils';
import type { LatestRoundData } from '../feed-detail-abis';
import type { FeedPriceHistoryPoint } from '../hooks/use-feed-price-history';
import { PriceHistoryChart } from './feed-price-history-chart';
import {
  CopyAddressButton,
  DependencyTypeValue,
  DetailRow,
  FeedProvenanceBadges,
  FeedTypeValue,
  getDistinctFeedDescription,
  isChainlinkFeedLeg,
  MonarchVerifiedBadge,
  ProviderLink,
  SectionShell,
  StatTile,
} from './feed-shared';

export function FeedHero({
  leg,
  address,
  chainId,
  marketCount,
  totalSupplyUsd,
  totalBorrowUsd,
  oracleCount,
  isStatsLoading,
}: {
  leg: FeedDependencyLeg | null;
  address: string;
  chainId: number;
  marketCount: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  oracleCount: number;
  isStatsLoading?: boolean;
}) {
  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const networkImg = getNetworkImg(chainId);
  const isMonarchVerified = isMonarchVerifiedFeed(leg);
  const hasProviderBadge = !isMonarchVerified && Boolean(leg?.provider || leg?.vendor);
  const statValue = (value: string): string => (isStatsLoading ? 'Calculating' : value);

  return (
    <section className="rounded border border-border bg-surface px-5 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(36rem,1fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {networkImg && (
              <Image
                src={networkImg}
                alt={networkName}
                width={18}
                height={18}
              />
            )}
            <Badge size="sm">{networkName}</Badge>
            <FeedTypeBadge
              feedType={leg?.feedType}
              showUnknown
            />
            <FeedProvenanceBadges leg={leg} />
          </div>

          <h1 className="mt-4 break-words !py-0 !text-[1.625rem] !font-normal !leading-tight !text-foreground">
            {getFeedTitle(leg, address)}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasProviderBadge && (
              <ProviderLink
                leg={leg}
                chainId={chainId}
                className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1.5 text-xs leading-none text-secondary no-underline transition-colors hover:bg-gray-300 hover:text-primary dark:hover:bg-gray-700"
              />
            )}
            <AddressIdentity
              address={address}
              chainId={chainId}
            />
            <CopyAddressButton address={address} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Markets using"
              value={statValue(marketCount.toLocaleString('en-US'))}
              detail={isStatsLoading ? undefined : `${oracleCount.toLocaleString('en-US')} oracle contract${oracleCount === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Supply TVL"
              value={statValue(formatUsdCompact(totalSupplyUsd))}
            />
            <StatTile
              label="Borrow TVL"
              value={statValue(formatUsdCompact(totalBorrowUsd))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeedMetadataSection({
  leg,
  chainId,
  kind,
}: {
  leg: FeedDependencyLeg | null;
  chainId: number;
  kind: FeedDependencyOccurrence['kind'] | null;
}) {
  const description = getDistinctFeedDescription(leg);
  const isVault = kind === 'vault';
  const isMonarchVerified = isMonarchVerifiedFeed(leg);

  return (
    <SectionShell title={isVault ? 'Vault Conversion' : 'Feed Overview'}>
      <div>
        {description && (
          <DetailRow
            label="Description"
            value={description}
          />
        )}
        <DetailRow
          label="Type"
          value={
            <DependencyTypeValue
              leg={leg}
              kind={kind}
            />
          }
        />
        {isVault && leg?.symbol && (
          <DetailRow
            label="Vault token"
            value={leg.symbol}
          />
        )}
        {isVault && leg?.assetSymbol && (
          <DetailRow
            label="Underlying asset"
            value={leg.assetSymbol}
          />
        )}
        {!isMonarchVerified && (
          <DetailRow
            label="Provider"
            value={
              <ProviderLink
                leg={leg}
                chainId={chainId}
                className="inline-flex items-center justify-end gap-1.5 text-primary no-underline hover:underline"
              />
            }
          />
        )}
        {leg?.conversionSample && (
          <DetailRow
            label="Conversion sample"
            value={<span className="font-monospace text-xs">{leg.conversionSample}</span>}
          />
        )}
      </div>
    </SectionShell>
  );
}

export function VaultAccountingSection({ leg }: { leg: FeedDependencyLeg | null }) {
  return (
    <SectionShell title="Vault Accounting">
      <div>
        <DetailRow
          label="Conversion"
          value={
            leg?.symbol && leg.assetSymbol ? `${leg.symbol} to ${leg.assetSymbol}` : <span className="text-secondary">Unavailable</span>
          }
        />
        <DetailRow
          label="Sample input"
          value={
            leg?.conversionSample ? (
              <span className="font-monospace text-xs">{leg.conversionSample}</span>
            ) : (
              <span className="text-secondary">Unavailable</span>
            )
          }
        />
      </div>
    </SectionShell>
  );
}

export function FeedInspectionSection({
  leg,
  chainId,
  latestRoundData,
  latestAnswer,
  latestTimestamp,
  decimals,
  priceHistory,
  isPriceHistoryLoading,
  isPriceHistoryError,
}: {
  leg: FeedDependencyLeg | null;
  chainId: number;
  latestRoundData: LatestRoundData | null;
  latestAnswer: bigint | null;
  latestTimestamp: bigint | null;
  decimals: number | null;
  priceHistory: FeedPriceHistoryPoint[];
  isPriceHistoryLoading: boolean;
  isPriceHistoryError: boolean;
}) {
  const answer = latestRoundData?.[1] ?? latestAnswer;
  const updatedAt = latestRoundData?.[3] ?? latestTimestamp;
  const heartbeat = leg?.heartbeat ?? leg?.updateInterval ?? null;
  const deviationThreshold = leg?.deviationThreshold ?? leg?.updateSpread ?? null;
  const isChainlink = isChainlinkFeedLeg(leg);
  const isMonarchVerified = isMonarchVerifiedFeed(leg);
  const formattedAnswer = answer != null && decimals != null ? formatOraclePrice(answer, decimals) : 'Unavailable';

  return (
    <SectionShell title="Price, Last 24 Hours">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
        <PriceHistoryChart
          points={priceHistory}
          isLoading={isPriceHistoryLoading}
          isError={isPriceHistoryError}
        />

        <div>
          <DetailRow
            label="Type"
            value={<FeedTypeValue leg={leg} />}
          />
          {!isMonarchVerified && (
            <DetailRow
              label="Provider"
              value={
                <ProviderLink
                  leg={leg}
                  chainId={chainId}
                  className="inline-flex items-center justify-end gap-1.5 text-primary no-underline hover:underline"
                />
              }
            />
          )}
          {isMonarchVerified && (
            <DetailRow
              label="Verification"
              value={<MonarchVerifiedBadge />}
            />
          )}
          {leg?.builtBy && (
            <DetailRow
              label="Built by"
              value={leg.builtBy}
            />
          )}
          {leg?.noAdmin && (
            <DetailRow
              label="Admin controls"
              value="No admin"
            />
          )}
          {leg?.tier && !isMonarchVerified && (
            <DetailRow
              label={isChainlink ? 'Chainlink risk tier' : 'Risk tier'}
              value={`${leg.tier.toUpperCase()} risk`}
            />
          )}
          {leg?.riskTier != null && (
            <DetailRow
              label={isChainlink ? 'Chainlink risk tier' : 'Risk tier'}
              value={leg.riskTier}
            />
          )}
          {heartbeat != null && (
            <DetailRow
              label={leg?.updateInterval == null ? 'Heartbeat' : 'Update interval'}
              value={formatOracleDuration(heartbeat)}
            />
          )}
          {deviationThreshold != null && (
            <DetailRow
              label={leg?.updateSpread == null ? 'Deviation threshold' : 'Update spread'}
              value={`${deviationThreshold}%`}
            />
          )}
          <DetailRow
            label="Current price"
            value={<span className="tabular-nums">{formattedAnswer}</span>}
          />
          <DetailRow
            label="Last update"
            value={formatOptionalTimestamp(updatedAt)}
          />
          <DetailRow
            label="Decimals"
            value={decimals ?? leg?.decimals ?? 'Unknown'}
          />
        </div>
      </div>
    </SectionShell>
  );
}

export function ContractSection({
  chainId,
  aggregatorAddress,
  ownerAddress,
  version,
  safeOwners,
  safeThreshold,
}: {
  chainId: number;
  aggregatorAddress: Address | null;
  ownerAddress: Address | null;
  version: bigint | null;
  safeOwners: readonly Address[] | null;
  safeThreshold: bigint | null;
}) {
  return (
    <SectionShell title="Chainlink Contract Details">
      <div>
        <DetailRow
          label="Version"
          value={version?.toString() ?? 'Unavailable'}
        />
        <DetailRow
          label="Aggregator implementation"
          value={
            aggregatorAddress ? (
              <AddressIdentity
                address={aggregatorAddress}
                chainId={chainId}
              />
            ) : (
              'Not detected'
            )
          }
        />
        <DetailRow
          label="Owner contract"
          value={
            ownerAddress ? (
              <AddressIdentity
                address={ownerAddress}
                chainId={chainId}
              />
            ) : (
              'Unavailable'
            )
          }
        />
        <DetailRow
          label="Owner Safe"
          value={
            safeOwners && safeThreshold != null ? (
              `${safeThreshold.toString()} of ${safeOwners.length.toLocaleString('en-US')} Safe owners`
            ) : (
              <span className="text-secondary">Not detected</span>
            )
          }
        />
      </div>
    </SectionShell>
  );
}

export function OracleCoverageSection({ occurrences, chainId }: { occurrences: FeedDependencyOccurrence[]; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const uniqueOccurrences = getUniqueOracleOccurrences(occurrences);
  const totalPages = Math.max(1, Math.ceil(uniqueOccurrences.length / ORACLE_CONTRACTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOccurrences = uniqueOccurrences.slice((safePage - 1) * ORACLE_CONTRACTS_PAGE_SIZE, safePage * ORACLE_CONTRACTS_PAGE_SIZE);

  return (
    <SectionShell
      title="Oracle Contracts"
      detail="Oracle contracts that reference this feed."
    >
      {uniqueOccurrences.length === 0 ? (
        <p className="text-sm text-secondary">No indexed oracle contract references this feed.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead>Oracle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Upgradeability</TableHead>
                <TableHead className="text-right">Last scanned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {paginatedOccurrences.map((occurrence) => (
                <TableRow
                  key={`${occurrence.oracle.chainId}-${occurrence.oracle.address}`}
                  className="border-b border-border/50"
                >
                  <TableCell>
                    <AddressIdentity
                      address={occurrence.oracle.address}
                      chainId={chainId}
                    />
                  </TableCell>
                  <TableCell className="capitalize">{occurrence.oracle.type}</TableCell>
                  <TableCell>
                    <Badge
                      size="sm"
                      variant={occurrence.oracle.isUpgradable ? 'warning' : 'default'}
                    >
                      {occurrence.oracle.isUpgradable ? 'Upgradable' : 'Immutable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-secondary">{formatScannerTimestamp(occurrence.oracle.lastScannedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {uniqueOccurrences.length > ORACLE_CONTRACTS_PAGE_SIZE && (
            <TablePagination
              mode="fixed"
              currentPage={safePage}
              totalPages={totalPages}
              totalEntries={uniqueOccurrences.length}
              pageSize={ORACLE_CONTRACTS_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

export function MarketsSection({ dependencies, chainId }: { dependencies: FeedMarketDependency[]; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(dependencies.length / MARKETS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDependencies = dependencies.slice((safePage - 1) * MARKETS_PAGE_SIZE, safePage * MARKETS_PAGE_SIZE);

  return (
    <SectionShell title="Markets Using This Feed">
      {dependencies.length === 0 ? (
        <p className="text-sm text-secondary">No loaded markets currently use this feed.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[58rem] table-fixed">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead className="min-w-[15rem]">Market</TableHead>
                <TableHead className="text-center align-middle">Supplied</TableHead>
                <TableHead className="text-center align-middle">Borrowed</TableHead>
                <TableHead className="text-right">Utilization</TableHead>
                <TableHead className="text-right">Market ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {paginatedDependencies.map(({ market }) => (
                <TableRow
                  key={market.uniqueKey}
                  className="border-b border-border/50"
                >
                  <TableCell>
                    <MarketIdentity
                      market={market}
                      chainId={chainId}
                      mode={MarketIdentityMode.Focused}
                      showId={false}
                      showOracle={false}
                      showLltv
                    />
                  </TableCell>
                  <TableCell className="text-center align-middle tabular-nums whitespace-nowrap">
                    {formatUsdCompact(market.state.supplyAssetsUsd)}
                  </TableCell>
                  <TableCell className="text-center align-middle tabular-nums whitespace-nowrap">
                    {formatUsdCompact(market.state.borrowAssetsUsd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercentValue(market.state.utilization)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <MarketIdBadge
                        marketId={market.uniqueKey}
                        chainId={chainId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {dependencies.length > MARKETS_PAGE_SIZE && (
            <TablePagination
              mode="fixed"
              currentPage={safePage}
              totalPages={totalPages}
              totalEntries={dependencies.length}
              pageSize={MARKETS_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

export function EmptyRouteState({ addressLabel, chainIdLabel }: { addressLabel: string; chainIdLabel: string }) {
  return (
    <>
      <Header />
      <div className="container h-full pb-12 font-zen">
        <div className="mt-6">
          <Breadcrumbs
            items={[
              { label: 'Feeds', href: '/markets' },
              { label: 'Invalid feed', isCurrent: true },
            ]}
          />
        </div>
        <div className="mt-6 rounded border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-medium text-primary">Unsupported feed URL</h1>
          <p className="mt-2 text-sm text-secondary">
            Use a supported chain id and EVM address. Received chain {chainIdLabel || 'empty'} and address {addressLabel || 'empty'}.
          </p>
        </div>
      </div>
    </>
  );
}
