'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { type Abi, type Address, isAddress, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { LuCheck, LuCopy, LuGitBranch, LuShieldCheck, LuUsers } from 'react-icons/lu';
import Header from '@/components/layout/header/Header';
import { AddressIdentity } from '@/components/shared/address-identity';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { TablePagination } from '@/components/shared/table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import { useStyledToast } from '@/hooks/useStyledToast';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { FeedFreshnessSection } from '@/features/markets/components/oracle/MarketOracle/FeedFreshnessSection';
import { FeedTypeBadge, getFeedTypeInfo } from '@/features/markets/components/oracle/MarketOracle/FeedTypeBadge';
import { getExplorerURL } from '@/utils/external';
import {
  detectFeedVendorFromMetadata,
  formatOracleDuration,
  formatOraclePrice,
  getChainlinkFeedUrl,
  getChronicleFeedUrl,
  getFeedFreshnessStatus,
  mapProviderToVendor,
  OracleVendorIcons,
  PriceFeedVendors,
} from '@/utils/oracle';
import { getNetworkImg, getNetworkName, isSupportedNetwork, type SupportedNetworks } from '@/utils/networks';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import {
  findFeedMarketDependencies,
  findFeedOccurrences,
  formatLltv,
  formatPercentValue,
  formatUsdCompact,
  getFeedDescription,
  getFeedPairLabel,
  getFeedProviderLabel,
  getFeedTitle,
  getRepresentativeLeg,
  getUniqueOracleOccurrences,
  normalizeAddress,
  toFiniteNumber,
  type FeedDependencyLeg,
  type FeedDependencyOccurrence,
} from './feed-detail-utils';

const feedInspectorAbi = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestAnswer',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestTimestamp',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'description',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'aggregator',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;

const safeInspectorAbi = [
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getThreshold',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;

type LatestRoundData = readonly [bigint, bigint, bigint, bigint, bigint];

const ORACLE_CONTRACTS_PAGE_SIZE = 8;
const MARKETS_PAGE_SIZE = 10;

function routeValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getReadResult<T>(results: unknown, index: number): T | null {
  if (!Array.isArray(results)) return null;
  const entry = results[index] as { status?: string; result?: unknown } | undefined;
  if (entry?.status !== 'success') return null;
  return entry.result as T;
}

function isUsableAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value) && normalizeAddress(value) !== normalizeAddress(zeroAddress));
}

function formatOptionalTimestamp(seconds: bigint | number | null | undefined): string {
  if (seconds == null) return 'Unavailable';
  const numericSeconds = Number(seconds);
  if (!Number.isFinite(numericSeconds) || numericSeconds <= 0) return 'Unavailable';
  return new Date(numericSeconds * 1000).toLocaleString();
}

function formatScannerTimestamp(value: string | null | undefined): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString();
}

function getVendorIcon(leg: FeedDependencyLeg | null): string {
  if (!leg) return '';
  const vendor = leg.provider ? mapProviderToVendor(leg.provider) : PriceFeedVendors.Unknown;
  return OracleVendorIcons[vendor] || '';
}

function getVendorUrl(leg: FeedDependencyLeg | null, chainId: number): string {
  if (!leg) return '';
  const provider = leg.provider?.toLowerCase() ?? '';
  const baseAsset = leg.pair?.[0] ?? '';
  const quoteAsset = leg.pair?.[1] ?? '';

  if (provider.includes('chronicle')) {
    return getChronicleFeedUrl(baseAsset, quoteAsset);
  }

  if (provider.includes('chainlink') && leg.ens) {
    return getChainlinkFeedUrl(chainId, leg.ens);
  }

  return '';
}

function getDirectFeedFreshness({
  latestRoundData,
  latestTimestamp,
  decimals,
  heartbeat,
}: {
  latestRoundData: LatestRoundData | null;
  latestTimestamp: bigint | null;
  decimals: number | null;
  heartbeat: number | null | undefined;
}) {
  const roundAnswer = latestRoundData?.[1] ?? null;
  const roundUpdatedAt = latestRoundData?.[3] ?? null;
  const answer = roundAnswer;
  const updatedAt =
    roundUpdatedAt != null && roundUpdatedAt > 0n ? Number(roundUpdatedAt) : latestTimestamp != null ? Number(latestTimestamp) : null;
  const normalizedPrice = answer != null && decimals != null ? formatOraclePrice(answer, decimals) : null;
  return getFeedFreshnessStatus(updatedAt, heartbeat, { normalizedPrice });
}

function CopyAddressButton({ address }: { address: string }) {
  const toast = useStyledToast();

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(address);
        toast.success('Feed address copied', `${address.slice(0, 10)}...${address.slice(-6)}`);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
      aria-label="Copy feed address"
    >
      <LuCopy className="h-4 w-4" />
    </button>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="font-monospace text-[11px] uppercase text-secondary">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-secondary">{detail}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-b-0">
      <div className="text-sm text-secondary">{label}</div>
      <div className="max-w-[70%] text-right text-sm text-primary">{value}</div>
    </div>
  );
}

function SectionShell({ title, children, detail }: { title: string; children: React.ReactNode; detail?: string }) {
  return (
    <section className="rounded border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium text-primary">{title}</h2>
        {detail && <p className="mt-1 text-xs text-secondary">{detail}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusIconPill({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'muted';
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300'
      : tone === 'muted'
        ? 'border-border bg-surface-soft text-secondary'
        : 'border-primary/15 bg-primary/5 text-primary';

  return (
    <div className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs ${toneClass}`}>
      <span className="shrink-0">{icon}</span>
      <span className="text-secondary">{label}</span>
      <span className="font-medium text-primary">{value}</span>
    </div>
  );
}

function FeedHero({
  leg,
  address,
  chainId,
  marketCount,
  totalSupplyUsd,
  totalBorrowUsd,
  oracleCount,
  routeOccurrenceCount,
  hasFactoryVerifiedRoute,
  hasScannerMetadata,
}: {
  leg: FeedDependencyLeg | null;
  address: string;
  chainId: number;
  marketCount: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  oracleCount: number;
  routeOccurrenceCount: number;
  hasFactoryVerifiedRoute: boolean;
  hasScannerMetadata: boolean;
}) {
  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const networkImg = getNetworkImg(chainId);
  const vendorIcon = getVendorIcon(leg);
  const vendorUrl = getVendorUrl(leg, chainId);

  return (
    <section className="rounded border border-border bg-surface px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
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
            {leg?.provider && <Badge size="sm">{leg.provider}</Badge>}
          </div>

          <h1 className="break-words text-2xl font-semibold text-primary">{getFeedTitle(leg, address)}</h1>
          <p className="mt-2 max-w-[72ch] text-sm leading-6 text-secondary">{getFeedDescription(leg)}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AddressIdentity
              address={address}
              chainId={chainId}
            />
            <CopyAddressButton address={address} />
            <Link
              href={getExplorerURL(address as Address, chainId as SupportedNetworks)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-hovered px-2 text-xs text-secondary no-underline transition-colors hover:text-primary"
            >
              Explorer
              <ExternalLinkIcon className="h-3 w-3" />
            </Link>
            {vendorUrl && (
              <Link
                href={vendorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-hovered px-2 text-xs text-secondary no-underline transition-colors hover:text-primary"
              >
                {vendorIcon && (
                  <Image
                    src={vendorIcon}
                    alt={getFeedProviderLabel(leg)}
                    width={12}
                    height={12}
                  />
                )}
                Provider
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusIconPill
              icon={<LuGitBranch className="h-3.5 w-3.5" />}
              label="Routes"
              value={routeOccurrenceCount.toLocaleString('en-US')}
            />
            <StatusIconPill
              icon={<LuShieldCheck className="h-3.5 w-3.5" />}
              label="Factory"
              value={hasFactoryVerifiedRoute ? 'Verified' : 'Not verified'}
              tone={hasFactoryVerifiedRoute ? 'positive' : 'muted'}
            />
            <StatusIconPill
              icon={<LuCheck className="h-3.5 w-3.5" />}
              label="Scanner"
              value={hasScannerMetadata ? 'Matched' : 'Missing'}
              tone={hasScannerMetadata ? 'positive' : 'muted'}
            />
          </div>
        </div>

        <div className="grid min-w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
          <StatTile
            label="Markets relying"
            value={marketCount.toLocaleString('en-US')}
            detail={`${oracleCount.toLocaleString('en-US')} oracle contract${oracleCount === 1 ? '' : 's'}`}
          />
          <StatTile
            label="Supplied TVL"
            value={formatUsdCompact(totalSupplyUsd)}
            detail="Loan assets supplied in dependent markets"
          />
          <StatTile
            label="Borrowed"
            value={formatUsdCompact(totalBorrowUsd)}
            detail="Debt using markets that trust this leg"
          />
        </div>
      </div>
    </section>
  );
}

function FeedMetadataSection({ leg }: { leg: FeedDependencyLeg | null }) {
  const feedTypeInfo = getFeedTypeInfo(leg?.feedType);
  const heartbeat = leg?.heartbeat ?? leg?.updateInterval ?? null;

  return (
    <SectionShell title="Feed Details">
      <div className="space-y-4">
        <div className={`rounded border p-3 ${feedTypeInfo.badgeClassName}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{feedTypeInfo.label} feed</div>
            <FeedTypeBadge
              feedType={leg?.feedType}
              showUnknown
            />
          </div>
          <p className="text-sm leading-6">{feedTypeInfo.description}</p>
        </div>

        <div>
          <DetailRow
            label="Pair"
            value={getFeedPairLabel(leg)}
          />
          <DetailRow
            label="Provider"
            value={getFeedProviderLabel(leg)}
          />
          {leg?.tier && (
            <DetailRow
              label="Risk tier"
              value={`${leg.tier.toUpperCase()} risk`}
            />
          )}
          {leg?.riskTier != null && (
            <DetailRow
              label="Risk tier"
              value={leg.riskTier}
            />
          )}
          {heartbeat != null && (
            <DetailRow
              label={leg?.updateInterval != null ? 'Update interval' : 'Heartbeat'}
              value={formatOracleDuration(heartbeat)}
            />
          )}
          {(leg?.deviationThreshold != null || leg?.updateSpread != null) && (
            <DetailRow
              label={leg?.updateSpread != null ? 'Update spread' : 'Deviation threshold'}
              value={`${leg.updateSpread ?? leg.deviationThreshold}%`}
            />
          )}
          {leg?.conversionSample && (
            <DetailRow
              label="Conversion sample"
              value={<span className="font-monospace text-xs">{leg.conversionSample}</span>}
            />
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function LiveReadSection({
  leg,
  latestRoundData,
  latestAnswer,
  latestTimestamp,
  decimals,
  chainlinkCompatible,
}: {
  leg: FeedDependencyLeg | null;
  latestRoundData: LatestRoundData | null;
  latestAnswer: bigint | null;
  latestTimestamp: bigint | null;
  decimals: number | null;
  chainlinkCompatible: boolean;
}) {
  const answer = latestRoundData?.[1] ?? latestAnswer;
  const updatedAt = latestRoundData?.[3] ?? latestTimestamp;
  const heartbeat = leg?.heartbeat ?? leg?.updateInterval ?? null;
  const formattedAnswer = answer != null && decimals != null ? formatOraclePrice(answer, decimals) : 'Unavailable';

  return (
    <SectionShell
      title="Live Read"
      detail="Direct onchain reads from the feed address when it exposes AggregatorV3-compatible methods."
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-secondary">Interface</span>
        <Badge
          size="sm"
          variant={chainlinkCompatible ? 'success' : 'default'}
        >
          {chainlinkCompatible ? 'AggregatorV3' : 'No AggregatorV3'}
        </Badge>
      </div>
      <FeedFreshnessSection
        className="border-t-0 pt-0"
        feedFreshness={getDirectFeedFreshness({
          latestRoundData,
          latestTimestamp,
          decimals,
          heartbeat,
        })}
      />
      <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-secondary">Price</span>
          <span className="tabular-nums text-primary">{formattedAnswer}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-secondary">Updated</span>
          <span className="text-right text-primary">{formatOptionalTimestamp(updatedAt)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-secondary">Decimals</span>
          <span className="tabular-nums text-primary">{decimals ?? leg?.decimals ?? 'Unknown'}</span>
        </div>
        {latestRoundData?.[0] != null && (
          <div className="flex justify-between gap-4">
            <span className="text-secondary">Round</span>
            <span className="font-monospace text-xs text-primary">{latestRoundData[0].toString()}</span>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

function ContractSection({
  chainId,
  aggregatorAddress,
  ownerAddress,
  version,
  directDescription,
  safeOwners,
  safeThreshold,
}: {
  chainId: number;
  aggregatorAddress: Address | null;
  ownerAddress: Address | null;
  version: bigint | null;
  directDescription: string | null;
  safeOwners: readonly Address[] | null;
  safeThreshold: bigint | null;
}) {
  const displayedOwners = safeOwners?.slice(0, 8) ?? [];
  const hiddenOwnerCount = safeOwners ? Math.max(0, safeOwners.length - displayedOwners.length) : 0;

  return (
    <SectionShell
      title="Contract Structure"
      detail="Onchain reads from the feed address. Aggregator and Safe fields appear only when the contract exposes those interfaces."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <DetailRow
            label="Chainlink-compatible description"
            value={directDescription ?? 'Unavailable'}
          />
          <DetailRow
            label="Version"
            value={version?.toString() ?? 'Unavailable'}
          />
          <DetailRow
            label="Aggregator proxy"
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
            label="Owner"
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
        </div>

        <div className="rounded border border-border bg-surface-soft p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <LuUsers className="h-4 w-4 text-secondary" />
            Multisig signer set
          </div>
          {safeOwners && safeThreshold != null ? (
            <>
              <div className="mb-3 text-sm text-secondary">
                Safe owner requires {safeThreshold.toString()} of {safeOwners.length.toLocaleString('en-US')} signatures.
              </div>
              <div className="flex flex-wrap gap-2">
                {displayedOwners.map((owner) => (
                  <AddressIdentity
                    key={owner}
                    address={owner}
                    chainId={chainId}
                  />
                ))}
                {hiddenOwnerCount > 0 && <Badge size="sm">+{hiddenOwnerCount} more</Badge>}
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-secondary">No Safe signer list was returned from the owner address.</p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function OracleCoverageSection({ occurrences, chainId }: { occurrences: FeedDependencyOccurrence[]; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const uniqueOccurrences = getUniqueOracleOccurrences(occurrences);
  const totalPages = Math.max(1, Math.ceil(uniqueOccurrences.length / ORACLE_CONTRACTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOccurrences = uniqueOccurrences.slice((safePage - 1) * ORACLE_CONTRACTS_PAGE_SIZE, safePage * ORACLE_CONTRACTS_PAGE_SIZE);

  return (
    <SectionShell
      title="Oracle Contracts"
      detail="Scanner metadata for oracle contracts that include this feed leg."
    >
      {uniqueOccurrences.length === 0 ? (
        <p className="text-sm text-secondary">No scanner-backed oracle contract currently references this feed leg.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead className="px-3 py-2">Oracle</TableHead>
                <TableHead className="px-3 py-2">Type</TableHead>
                <TableHead className="px-3 py-2">Factory</TableHead>
                <TableHead className="px-3 py-2">Upgradeability</TableHead>
                <TableHead className="px-3 py-2">Proxy</TableHead>
                <TableHead className="px-3 py-2 text-right">Last scanned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {paginatedOccurrences.map((occurrence) => {
                const proxy = occurrence.oracle.proxy;
                return (
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
                        variant={occurrence.oracle.verifiedByFactory ? 'success' : 'default'}
                      >
                        {occurrence.oracle.verifiedByFactory ? 'Verified' : 'Not factory verified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        size="sm"
                        variant={occurrence.oracle.isUpgradable ? 'warning' : 'default'}
                      >
                        {occurrence.oracle.isUpgradable ? 'Upgradable' : 'Immutable'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {proxy.isProxy ? (
                        <div className="flex flex-col gap-1">
                          <Badge size="sm">{proxy.proxyType ?? 'Proxy'}</Badge>
                          {proxy.implementation && (
                            <AddressIdentity
                              address={proxy.implementation}
                              chainId={chainId}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-secondary">No proxy</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-secondary">{formatScannerTimestamp(occurrence.oracle.lastScannedAt)}</TableCell>
                  </TableRow>
                );
              })}
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

function MarketsSection({ dependencies, chainId }: { dependencies: ReturnType<typeof findFeedMarketDependencies>; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(dependencies.length / MARKETS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDependencies = dependencies.slice((safePage - 1) * MARKETS_PAGE_SIZE, safePage * MARKETS_PAGE_SIZE);

  return (
    <SectionShell
      title="Markets Relying On This Leg"
      detail="Markets are sorted by supplied TVL. Supply and borrow values are current market state values."
    >
      {dependencies.length === 0 ? (
        <p className="text-sm text-secondary">No active market from the loaded market registry currently references this feed leg.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead className="min-w-[15rem] px-3 py-2">Market</TableHead>
                <TableHead className="px-3 py-2 text-right">Supplied</TableHead>
                <TableHead className="px-3 py-2 text-right">Borrowed</TableHead>
                <TableHead className="px-3 py-2 text-right">Utilization</TableHead>
                <TableHead className="px-3 py-2 text-right">LLTV</TableHead>
                <TableHead className="px-3 py-2 text-right">Market ID</TableHead>
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
                      showLltv={false}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsdCompact(market.state.supplyAssetsUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsdCompact(market.state.borrowAssetsUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercentValue(market.state.utilization)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatLltv(market.lltv)}</TableCell>
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

function EmptyRouteState({ addressLabel, chainIdLabel }: { addressLabel: string; chainIdLabel: string }) {
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
          <h1 className="text-lg font-medium text-primary">Feed route is not supported</h1>
          <p className="mt-2 text-sm text-secondary">
            The route needs a supported numeric chain id and an EVM address. Received chain {chainIdLabel || 'empty'} and address{' '}
            {addressLabel || 'empty'}.
          </p>
        </div>
      </div>
    </>
  );
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
  const { data: markets, isLoading: marketsLoading } = useMarketsQuery({
    refetchOnWindowFocus: false,
  });

  const feedContracts = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return [
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestRoundData' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestAnswer' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestTimestamp' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'decimals' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'description' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'version' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'aggregator' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'owner' as const, chainId },
    ];
  }, [chainId, feedAddress, isRouteSupported]);

  const { data: feedReadResults } = useReadContracts({
    contracts: feedContracts,
    allowFailure: true,
    query: {
      enabled: feedContracts.length > 0,
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const latestRoundData = getReadResult<LatestRoundData>(feedReadResults, 0);
  const latestAnswer = getReadResult<bigint>(feedReadResults, 1);
  const latestTimestamp = getReadResult<bigint>(feedReadResults, 2);
  const feedDecimalsRaw = getReadResult<number>(feedReadResults, 3);
  const directDescription = getReadResult<string>(feedReadResults, 4);
  const version = getReadResult<bigint>(feedReadResults, 5);
  const aggregatorAddressRaw = getReadResult<string>(feedReadResults, 6);
  const ownerAddressRaw = getReadResult<string>(feedReadResults, 7);
  const aggregatorAddress =
    isUsableAddress(aggregatorAddressRaw) && normalizeAddress(aggregatorAddressRaw) !== normalizeAddress(feedAddress)
      ? aggregatorAddressRaw
      : null;
  const ownerAddress = isUsableAddress(ownerAddressRaw) ? ownerAddressRaw : null;
  const chainlinkCompatible = Boolean(latestRoundData || latestAnswer != null || feedDecimalsRaw != null || directDescription);

  const safeContracts = useMemo(() => {
    if (!ownerAddress || !isRouteSupported) return [];
    return [
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getOwners' as const, chainId },
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getThreshold' as const, chainId },
    ];
  }, [chainId, isRouteSupported, ownerAddress]);

  const { data: safeReadResults } = useReadContracts({
    contracts: safeContracts,
    allowFailure: true,
    query: {
      enabled: safeContracts.length > 0,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const safeOwners = getReadResult<readonly Address[]>(safeReadResults, 0);
  const safeThreshold = getReadResult<bigint>(safeReadResults, 1);

  const occurrences = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedOccurrences(oracleMetadataMap, feedAddress, chainId);
  }, [chainId, feedAddress, isRouteSupported, oracleMetadataMap]);

  const dependencies = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedMarketDependencies({
      markets,
      metadataRecord: oracleMetadataMap,
      feedAddress,
      chainId,
    });
  }, [chainId, feedAddress, isRouteSupported, markets, oracleMetadataMap]);

  const representativeLeg = useMemo(() => getRepresentativeLeg(occurrences), [occurrences]);
  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const feedTitle = feedAddress ? getFeedTitle(representativeLeg, feedAddress) : 'Feed';
  const feedDecimals = feedDecimalsRaw ?? representativeLeg?.decimals ?? null;
  const totalSupplyUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.supplyAssetsUsd), 0);
  const totalBorrowUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.borrowAssetsUsd), 0);
  const uniqueOracleCount = getUniqueOracleOccurrences(occurrences).length;
  const hasFactoryVerifiedRoute = occurrences.some((occurrence) => occurrence.oracle.verifiedByFactory);

  if (!isRouteSupported) {
    return (
      <EmptyRouteState
        addressLabel={routeAddress}
        chainIdLabel={chainParam ?? ''}
      />
    );
  }

  const isMetadataLoading = oracleMetadataLoading || marketsLoading;
  const vendorResult =
    representativeLeg?.address && !representativeLeg.conversionSample
      ? detectFeedVendorFromMetadata(representativeLeg as EnrichedFeed)
      : null;
  const vendorIcon =
    vendorResult && vendorResult.vendor !== PriceFeedVendors.Unknown
      ? OracleVendorIcons[vendorResult.vendor]
      : getVendorIcon(representativeLeg);

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
            routeOccurrenceCount={occurrences.length}
            hasFactoryVerifiedRoute={hasFactoryVerifiedRoute}
            hasScannerMetadata={representativeLeg != null}
          />

          {isMetadataLoading && (
            <div className="rounded border border-border bg-surface px-5 py-4 text-sm text-secondary shadow-sm">
              Loading market and oracle dependency data...
            </div>
          )}

          {oracleMetadataError && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-800 dark:text-yellow-200">
              Oracle metadata failed to load for {networkName}. Live contract reads may still work.
            </div>
          )}

          {!isMetadataLoading && !representativeLeg && (
            <div className="rounded border border-border bg-surface px-5 py-4 text-sm text-secondary shadow-sm">
              This address was not found in the current scanner dependency graph. Contract reads and explorer links are still shown.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
            <FeedMetadataSection leg={representativeLeg} />

            <LiveReadSection
              leg={representativeLeg}
              latestRoundData={latestRoundData}
              latestAnswer={latestAnswer}
              latestTimestamp={latestTimestamp}
              decimals={feedDecimals}
              chainlinkCompatible={chainlinkCompatible}
            />
          </div>

          <ContractSection
            chainId={chainId}
            aggregatorAddress={aggregatorAddress}
            ownerAddress={ownerAddress}
            version={version}
            directDescription={directDescription}
            safeOwners={safeOwners}
            safeThreshold={safeThreshold}
          />

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
