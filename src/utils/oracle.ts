/**
 * Oracle Utilities
 *
 * This module provides utilities for working with scanner-backed oracle
 * metadata. Standard and meta oracle rendering, filtering, and warning logic
 * should resolve through that metadata rather than Morpho API feed payloads.
 *
 * For full type system documentation, see:
 * https://github.com/monarch-xyz/oracles/blob/master/docs/TYPES.md
 */

import { formatUnits } from 'viem';
import {
  getOracleFromMetadata,
  type EnrichedFeed,
  type MetaOracleOutputData,
  type OracleFeedProvider,
  type OracleMetadataRecord,
  type OracleOutputData,
} from '@/hooks/useOracleMetadata';
import { formatSimple } from './balance';
import { SupportedNetworks } from './networks';

type VendorInfo = {
  coreVendors: PriceFeedVendors[]; // Well-known vendors (Chainlink, Redstone, etc.)
  taggedVendors: string[]; // Tagged by Morpho but not core (Pendle, Spectra, etc.)
  hasCompletelyUnknown: boolean; // True unknown feeds (no data found)
  hasTaggedUnknown: boolean; // Tagged but not in core vendors
  // Legacy properties for backward compatibility
  vendors: PriceFeedVendors[];
  hasUnknown: boolean;
};

export enum OracleType {
  Standard = 'Standard',
  Custom = 'Custom',
  Meta = 'Meta',
}

export enum PriceFeedVendors {
  Chainlink = 'Chainlink',
  PythNetwork = 'Pyth Network',
  Redstone = 'Redstone',
  Oval = 'Oval',
  Compound = 'Compound',
  Lido = 'Lido',
  Pendle = 'Pendle',
  API3 = 'API3',
  Unknown = 'Unknown',
}

export const OracleVendorIcons: Record<PriceFeedVendors, string> = {
  [PriceFeedVendors.Chainlink]: require('../imgs/oracles/chainlink.png') as string,
  [PriceFeedVendors.PythNetwork]: require('../imgs/oracles/pyth.png') as string,
  [PriceFeedVendors.Redstone]: require('../imgs/oracles/redstone.svg') as string,
  [PriceFeedVendors.Oval]: require('../imgs/oracles/uma.png') as string,
  [PriceFeedVendors.Compound]: require('../imgs/oracles/compound.webp') as string,
  [PriceFeedVendors.Lido]: require('../imgs/oracles/lido.png') as string,
  [PriceFeedVendors.Pendle]: require('../imgs/oracles/pendle.png') as string,
  [PriceFeedVendors.API3]: require('../imgs/oracles/api3.svg') as string,
  [PriceFeedVendors.Unknown]: '',
};

/**
 * Map provider string from oracle metadata to FE enum
 */
export function mapProviderToVendor(provider: OracleFeedProvider): PriceFeedVendors {
  if (!provider) return PriceFeedVendors.Unknown;

  const normalizedProvider = provider.trim().toLowerCase();

  if (normalizedProvider.includes('pendle')) return PriceFeedVendors.Pendle;

  const mapping: Record<string, PriceFeedVendors> = {
    chainlink: PriceFeedVendors.Chainlink,
    redstone: PriceFeedVendors.Redstone,
    compound: PriceFeedVendors.Compound,
    lido: PriceFeedVendors.Lido,
    oval: PriceFeedVendors.Oval,
    pyth: PriceFeedVendors.PythNetwork,
    api3: PriceFeedVendors.API3,
  };

  return mapping[normalizedProvider] ?? PriceFeedVendors.Unknown;
}

/**
 * Generate Chainlink feed URL from ENS name
 */
export function getChainlinkFeedUrl(chainId: number, ens: string): string {
  const networkPaths: Partial<Record<SupportedNetworks, string>> = {
    [SupportedNetworks.Mainnet]: 'ethereum/mainnet',
    [SupportedNetworks.Base]: 'base/base',
    [SupportedNetworks.Polygon]: 'polygon/mainnet',
    [SupportedNetworks.Arbitrum]: 'arbitrum/mainnet',
    [SupportedNetworks.HyperEVM]: 'hyperliquid/mainnet',
    [SupportedNetworks.Monad]: 'monad/mainnet',
  };

  const path = networkPaths[chainId as SupportedNetworks];
  if (!path) return '';

  return `https://data.chain.link/feeds/${path}/${ens}`;
}

export type FeedVendorResult = {
  vendor: PriceFeedVendors;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

/**
 * Detect feed vendor from enriched metadata (primary method)
 * Use this when oracle metadata is available from useOracleMetadata hook
 */
export function detectFeedVendorFromMetadata(feed: EnrichedFeed | null | undefined): FeedVendorResult {
  if (!feed) {
    return {
      vendor: PriceFeedVendors.Unknown,
      assetPair: { baseAsset: 'Unknown', quoteAsset: 'Unknown' },
    };
  }

  const isPendleFeed =
    feed.pendleFeedKind != null ||
    feed.pendleFeedSubtype != null ||
    feed.baseDiscountPerYear != null ||
    feed.pt != null ||
    feed.ptSymbol != null;
  const vendor = isPendleFeed ? PriceFeedVendors.Pendle : mapProviderToVendor(feed.provider);

  // Try to extract pair from feed.pair, or fallback to parsing description
  let baseAsset = 'Unknown';
  let quoteAsset = 'Unknown';

  if (feed.pair.length === 2) {
    [baseAsset, quoteAsset] = feed.pair;
  } else if (feed.description) {
    // Fallback: try to parse description for pair info
    // Handle formats like "ETH / USD", "sYUSD_FUNDAMENTAL", "WETH_ETH"
    const slashMatch = feed.description.match(/^(.+?)\s*\/\s*(.+)$/);
    if (slashMatch) {
      baseAsset = slashMatch[1].trim();
      quoteAsset = slashMatch[2].trim();
    } else {
      const fundamentalMatch = feed.description.match(/^(.+?)_FUNDAMENTAL$/i);
      if (fundamentalMatch) {
        baseAsset = fundamentalMatch[1];
        quoteAsset = 'USD';
      } else {
        const underscoreMatch = feed.description.match(/^([A-Za-z0-9]+)_([A-Za-z0-9]+)$/);
        if (underscoreMatch) {
          baseAsset = underscoreMatch[1];
          quoteAsset = underscoreMatch[2];
        }
      }
    }
  }

  return {
    vendor,
    assetPair: { baseAsset, quoteAsset },
  };
}

export function getOracleTypeDescription(oracleType: OracleType): string {
  if (oracleType === OracleType.Standard) return 'Standard Oracle';
  if (oracleType === OracleType.Meta) return 'Meta Oracle';
  return 'Custom Oracle';
}

export function getOracleType(oracleAddress?: string, chainId?: number, metadataMap?: OracleMetadataRecord) {
  if (metadataMap && oracleAddress) {
    const metadata = getOracleFromMetadata(metadataMap, oracleAddress, chainId);
    if (metadata?.type === 'meta') return OracleType.Meta;
    if (metadata?.type === 'standard') return OracleType.Standard;
  }

  return OracleType.Custom;
}

export function parsePriceFeedVendors(oracleData: OracleOutputData | null | undefined): VendorInfo {
  if (!oracleData) {
    return {
      coreVendors: [],
      taggedVendors: [],
      hasCompletelyUnknown: false,
      hasTaggedUnknown: false,
      vendors: [],
      hasUnknown: false,
    };
  }

  const feeds = [oracleData.baseFeedOne, oracleData.baseFeedTwo, oracleData.quoteFeedOne, oracleData.quoteFeedTwo];
  return classifyEnrichedFeeds(feeds);
}

/**
 * Classify enriched feeds into vendor categories.
 * Shared by parsePriceFeedVendors (after enriched lookup) and parseMetaOracleVendors.
 */
function classifyEnrichedFeeds(feeds: (EnrichedFeed | null)[]): VendorInfo {
  const coreVendors = new Set<PriceFeedVendors>();
  const taggedVendors = new Set<string>();
  let hasCompletelyUnknown = false;
  let hasTaggedUnknown = false;

  for (const feed of feeds) {
    if (feed?.address) {
      const feedResult = detectFeedVendorFromMetadata(feed);

      if (feedResult.vendor === PriceFeedVendors.Unknown) {
        const taggedVendor = feed.provider?.trim();
        if (taggedVendor) {
          taggedVendors.add(taggedVendor);
          hasTaggedUnknown = true;
        } else {
          hasCompletelyUnknown = true;
        }
      } else {
        coreVendors.add(feedResult.vendor);
      }
    }
  }

  const legacyVendors = Array.from(coreVendors);

  return {
    coreVendors: Array.from(coreVendors),
    taggedVendors: Array.from(taggedVendors),
    hasCompletelyUnknown,
    hasTaggedUnknown,
    vendors: legacyVendors,
    hasUnknown: hasCompletelyUnknown || hasTaggedUnknown,
  };
}

/**
 * Extract vendors from a meta oracle's primary and backup oracle feeds
 */
export function parseMetaOracleVendors(metaData: MetaOracleOutputData): VendorInfo {
  const { primary, backup } = metaData.oracleSources;
  const feeds = [
    ...(primary ? [primary.baseFeedOne, primary.baseFeedTwo, primary.quoteFeedOne, primary.quoteFeedTwo] : []),
    ...(backup ? [backup.baseFeedOne, backup.baseFeedTwo, backup.quoteFeedOne, backup.quoteFeedTwo] : []),
  ];
  return classifyEnrichedFeeds(feeds);
}

type CheckFeedsPathResult = {
  isValid: boolean;
  hasUnknownFeed?: boolean;
  missingPath?: string;
  expectedPath?: string;
};

/**
 * Normalize asset symbols for comparison
 */
function normalizeSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase();
  return normalized === 'weth' ? 'eth' : normalized;
}

type FeedPathEntry = {
  path: { base: string; quote: string };
  type: 'base1' | 'base2' | 'quote1' | 'quote2' | 'baseVault' | 'quoteVault';
  hasData: boolean;
};

/**
 * Validate that feed paths compose a valid price path from collateral to loan.
 * Shared by checkFeedsPath (standard oracles) and checkEnrichedFeedsPath (meta oracles).
 */
function validateFeedPaths(feedPaths: FeedPathEntry[], collateralSymbol: string, loanSymbol: string): CheckFeedsPathResult {
  const hasUnknownAssets = feedPaths.some(({ path }) => path.base === 'Unknown' || path.quote === 'Unknown');

  if (hasUnknownAssets) {
    return { isValid: false, hasUnknownFeed: true };
  }

  const numeratorCounts = new Map<string, number>();
  const denominatorCounts = new Map<string, number>();

  const incrementCount = (map: Map<string, number>, asset: string) => {
    if (asset !== 'EMPTY') {
      const normalizedAsset = normalizeSymbol(asset);
      map.set(normalizedAsset, (map.get(normalizedAsset) ?? 0) + 1);
    }
  };

  for (const { path, type, hasData } of feedPaths) {
    if (!hasData) continue;

    if (type === 'base1' || type === 'base2' || type === 'baseVault') {
      incrementCount(numeratorCounts, path.base);
      incrementCount(denominatorCounts, path.quote);
    } else {
      incrementCount(denominatorCounts, path.base);
      incrementCount(numeratorCounts, path.quote);
    }
  }

  const cancelOut = (num: Map<string, number>, den: Map<string, number>) => {
    const assets = new Set([...num.keys(), ...den.keys()]);

    for (const asset of assets) {
      const numCount = num.get(asset) ?? 0;
      const denCount = den.get(asset) ?? 0;
      const minCount = Math.min(numCount, denCount);

      if (minCount > 0) {
        num.set(asset, numCount - minCount);
        den.set(asset, denCount - minCount);

        if (num.get(asset) === 0) num.delete(asset);
        if (den.get(asset) === 0) den.delete(asset);
      }
    }
  };

  cancelOut(numeratorCounts, denominatorCounts);

  const remainingNumeratorAssets = Array.from(numeratorCounts.keys()).filter((asset) => (numeratorCounts.get(asset) ?? 0) > 0);
  const remainingDenominatorAssets = Array.from(denominatorCounts.keys()).filter((asset) => (denominatorCounts.get(asset) ?? 0) > 0);

  const normalizedCollateralSymbol = normalizeSymbol(collateralSymbol);
  const normalizedLoanSymbol = normalizeSymbol(loanSymbol);

  const expectedPath = `${normalizedCollateralSymbol}/${normalizedLoanSymbol}`;

  const isValid =
    remainingNumeratorAssets.length === 1 &&
    remainingDenominatorAssets.length === 1 &&
    remainingNumeratorAssets[0] === normalizedCollateralSymbol &&
    remainingDenominatorAssets[0] === normalizedLoanSymbol &&
    (numeratorCounts.get(normalizedCollateralSymbol) ?? 0) === 1 &&
    (denominatorCounts.get(normalizedLoanSymbol) ?? 0) === 1;

  if (isValid) {
    return { isValid: true };
  }

  let missingPath = '';
  if (remainingNumeratorAssets.length === 0 && remainingDenominatorAssets.length === 0) {
    missingPath = 'All assets canceled out - no price path found';
  } else {
    const actualPath = `${remainingNumeratorAssets.join('*')}/${remainingDenominatorAssets.join('*')}`;
    missingPath = `Oracle uses ${actualPath.toUpperCase()} instead of ${expectedPath.toUpperCase()}. Depegs or divergence won't be reflected`;
  }

  return {
    isValid: false,
    missingPath,
    expectedPath,
  };
}

export function checkFeedsPath(
  oracleData: OracleOutputData | null | undefined,
  collateralSymbol: string,
  loanSymbol: string,
): CheckFeedsPathResult {
  if (!oracleData) {
    return { isValid: false, missingPath: 'No oracle data provided' };
  }

  const feedPaths: FeedPathEntry[] = [
    { feed: oracleData.baseFeedOne, type: 'base1' as const },
    { feed: oracleData.baseFeedTwo, type: 'base2' as const },
    { feed: oracleData.quoteFeedOne, type: 'quote1' as const },
    { feed: oracleData.quoteFeedTwo, type: 'quote2' as const },
  ].map(({ feed, type }) => ({
    path: getEnrichedFeedPath(feed),
    type,
    hasData: !!feed?.address,
  }));

  if (oracleData.baseVault?.pair?.length === 2) {
    feedPaths.push({
      path: { base: oracleData.baseVault.pair[0], quote: oracleData.baseVault.pair[1] },
      type: 'baseVault',
      hasData: true,
    });
  }
  if (oracleData.quoteVault?.pair?.length === 2) {
    feedPaths.push({
      path: { base: oracleData.quoteVault.pair[0], quote: oracleData.quoteVault.pair[1] },
      type: 'quoteVault',
      hasData: true,
    });
  }

  return validateFeedPaths(feedPaths, collateralSymbol, loanSymbol);
}

/**
 * Resolve pair path directly from an enriched feed
 */
function getEnrichedFeedPath(feed: EnrichedFeed | null): { base: string; quote: string } {
  if (!feed?.address) return { base: 'EMPTY', quote: 'EMPTY' };
  if (feed.pair?.length === 2) return { base: feed.pair[0], quote: feed.pair[1] };
  return { base: 'Unknown', quote: 'Unknown' };
}

/**
 * Check feed paths for meta oracles using pre-enriched scanner data
 */
export function checkEnrichedFeedsPath(oracleData: OracleOutputData, collateralSymbol: string, loanSymbol: string): CheckFeedsPathResult {
  return checkFeedsPath(oracleData, collateralSymbol, loanSymbol);
}

/**
 * Format seconds into a human-readable duration (e.g. "1h", "24h", "7d")
 */
export function formatOracleDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export type FeedFreshnessStatus = {
  updatedAt: number | null;
  ageSeconds: number | null;
  staleAfterSeconds: number | null;
  isStale: boolean;
  updateKind: FeedUpdateKind;
  normalizedPrice: string | null;
};

export type FeedUpdateKind = 'reported' | 'derived';

type FeedFreshnessOptions = {
  updateKind?: FeedUpdateKind;
  normalizedPrice?: string | null;
};

/**
 * Determine if a feed is stale.
 * If no heartbeat is available, we still expose age but avoid stale classification.
 */
export function getFeedFreshnessStatus(
  updatedAt: number | null | undefined,
  heartbeatSeconds: number | null | undefined,
  options?: FeedFreshnessOptions,
): FeedFreshnessStatus {
  const updateKind = options?.updateKind ?? 'reported';
  const normalizedPrice = options?.normalizedPrice ?? null;

  if (!updatedAt || updatedAt <= 0) {
    return {
      updatedAt: null,
      ageSeconds: null,
      staleAfterSeconds: null,
      isStale: false,
      updateKind,
      normalizedPrice,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, nowSeconds - updatedAt);
  const staleAfterSeconds = heartbeatSeconds && heartbeatSeconds > 0 ? heartbeatSeconds : null;

  return {
    updatedAt,
    ageSeconds,
    staleAfterSeconds,
    isStale: staleAfterSeconds != null ? ageSeconds > staleAfterSeconds : false,
    updateKind,
    normalizedPrice,
  };
}

/**
 * Format unix timestamp (seconds) into local date/time.
 */
export function formatOracleTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

/**
 * Compact timestamp for tight UI surfaces, honoring user locale.
 */
export function formatOracleTimestampCompact(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format raw feed answer using the shared simple-number display style.
 */
export function formatOraclePrice(answerRaw: bigint, decimals: number): string {
  const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.min(36, Math.floor(decimals))) : 8;
  const raw = formatUnits(answerRaw, safeDecimals);
  const numericValue = Number(raw);

  if (Number.isFinite(numericValue)) {
    return formatSimple(numericValue);
  }

  if (!raw.includes('.')) return raw;

  const [integerPart, fractionPart = ''] = raw.split('.');
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  if (!trimmedFraction) return integerPart;

  const cappedFraction = trimmedFraction.slice(0, 4).replace(/0+$/, '');
  return cappedFraction ? `${integerPart}.${cappedFraction}` : integerPart;
}

/**
 * Helper function to get truncated asset names (max 5 chars)
 */
export function getTruncatedAssetName(asset: string): string {
  return asset.length > 5 ? `${asset.slice(0, 5)}..` : asset;
}
