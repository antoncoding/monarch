/**
 * Oracle Utilities
 *
 * This module provides utilities for working with oracle data from two sources:
 * 1. Morpho API - Basic oracle/feed info (OracleFeed, MorphoChainlinkOracleData)
 * 2. Oracles Scanner - Extended metadata (EnrichedFeed via useOracleMetadata hook)
 *
 * Type hierarchy:
 * - OracleFeed: Basic feed from Morpho API
 * - EnrichedFeed: Extended feed from oracles scanner (includes provider, tier, heartbeat, deviationThreshold, ens, feedType)
 * - FeedData: Simplified type for UI components
 *
 * For full type system documentation, see:
 * https://github.com/monarch-xyz/oracles/blob/master/docs/TYPES.md
 */

import { zeroAddress, type Address } from 'viem';
import {
  getFeedFromOracleData,
  getOracleFromMetadata,
  isMetaOracleData,
  type EnrichedFeed,
  type MetaOracleOutputData,
  type OracleFeedProvider,
  type OracleMetadataRecord,
  type OracleOutputData,
} from '@/hooks/useOracleMetadata';
import { SupportedNetworks, isSupportedChain } from './networks';
import type { MorphoChainlinkOracleData, OracleFeed } from './types';

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
  [PriceFeedVendors.Unknown]: '',
};

/**
 * Map provider string from oracle metadata to FE enum
 */
export function mapProviderToVendor(provider: OracleFeedProvider): PriceFeedVendors {
  if (!provider) return PriceFeedVendors.Unknown;

  const mapping: Record<string, PriceFeedVendors> = {
    Chainlink: PriceFeedVendors.Chainlink,
    Redstone: PriceFeedVendors.Redstone,
    Compound: PriceFeedVendors.Compound,
    Lido: PriceFeedVendors.Lido,
    Oval: PriceFeedVendors.Oval,
    Pyth: PriceFeedVendors.PythNetwork,
    Pendle: PriceFeedVendors.Pendle,
  };

  return mapping[provider] ?? PriceFeedVendors.Unknown;
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

// Simplified feed data structure (replacing old vendor-specific types)
export type FeedData = {
  address: string;
  vendor: string;
  description: string;
  pair: [string, string];
  decimals: number;
  tier?: string; // Chainlink feed category: "verified", "high", "medium", "low", "custom", etc.
  heartbeat?: number;
  deviationThreshold?: number;
  ens?: string; // Chainlink ENS name for feed URL (e.g. "eth-usd")
  feedType?: string; // Redstone feed type: "market" or "fundamental"
  baseDiscountPerYear?: string; // Pendle base discount per year (raw 18-decimal value)
  innerOracle?: string; // Pendle inner oracle address
  pt?: string; // Pendle PT token address
  ptSymbol?: string; // Pendle PT token symbol
};

export type FeedVendorResult = {
  vendor: PriceFeedVendors;
  data: FeedData | null;
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
      data: null,
      assetPair: { baseAsset: 'Unknown', quoteAsset: 'Unknown' },
    };
  }

  const vendor = mapProviderToVendor(feed.provider);

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

  const feedData: FeedData = {
    address: feed.address,
    vendor: feed.provider ?? 'Unknown',
    description: feed.description,
    pair: [baseAsset, quoteAsset] as [string, string],
    decimals: feed.decimals ?? 18,
    tier: feed.tier,
    heartbeat: feed.heartbeat,
    deviationThreshold: feed.deviationThreshold,
    ens: feed.ens,
    feedType: feed.feedType,
    baseDiscountPerYear: feed.baseDiscountPerYear,
    innerOracle: feed.innerOracle,
    pt: feed.pt,
    ptSymbol: feed.ptSymbol,
  };

  return {
    vendor,
    data: feedData,
    assetPair: { baseAsset, quoteAsset },
  };
}

/**
 * Legacy feed vendor detection (fallback when metadata not available)
 * @deprecated Use detectFeedVendorFromMetadata with oracle metadata instead
 */
export function detectFeedVendor(_feedAddress: Address | string, _chainId: number): FeedVendorResult {
  // Without static data files, we return Unknown
  // The metadata-based detection should be used instead
  return {
    vendor: PriceFeedVendors.Unknown,
    data: null,
    assetPair: { baseAsset: 'Unknown', quoteAsset: 'Unknown' },
  };
}

export function getOracleTypeDescription(oracleType: OracleType): string {
  if (oracleType === OracleType.Standard) return 'Standard Oracle';
  if (oracleType === OracleType.Meta) return 'Meta Oracle';
  return 'Custom Oracle';
}

/**
 * Get feed path from oracle feed
 */
function getFeedPath(
  feed: OracleFeed | null | undefined,
  _chainId: number,
  oracleMetadataData?: OracleOutputData,
): { base: string; quote: string } {
  if (!feed || !feed.address) return { base: 'EMPTY', quote: 'EMPTY' };

  // Try to get from metadata first
  if (oracleMetadataData) {
    const enrichedFeed = getFeedFromOracleData(oracleMetadataData, feed.address);
    if (enrichedFeed && enrichedFeed.pair.length === 2) {
      return { base: enrichedFeed.pair[0], quote: enrichedFeed.pair[1] };
    }
  }

  return { base: 'Unknown', quote: 'Unknown' };
}

export function getOracleType(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  oracleAddress?: string,
  chainId?: number,
  metadataMap?: OracleMetadataRecord,
) {
  // Check scanner metadata for meta oracle type
  if (metadataMap && oracleAddress) {
    const metadata = getOracleFromMetadata(metadataMap, oracleAddress);
    if (metadata?.type === 'meta') return OracleType.Meta;
  }

  // Morpho API only contains oracleData if it follows the standard MorphoOracle structure with feeds
  if (!oracleData) return OracleType.Custom;

  if (
    oracleData.baseFeedOne !== null ||
    oracleData.baseFeedTwo !== null ||
    oracleData.quoteFeedOne !== null ||
    oracleData.quoteFeedTwo !== null
  )
    return OracleType.Standard;

  // Other logics to determine oracle types
  if (oracleAddress === zeroAddress || (chainId && isSupportedChain(chainId))) return OracleType.Custom;
  return OracleType.Custom;
}

type ParsePriceFeedVendorsOptions = {
  metadataMap?: OracleMetadataRecord;
  oracleAddress?: string;
};

export function parsePriceFeedVendors(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  chainId: number,
  options?: ParsePriceFeedVendorsOptions,
): VendorInfo {
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

  if (!oracleData.baseFeedOne && !oracleData.baseFeedTwo && !oracleData.quoteFeedOne && !oracleData.quoteFeedTwo) {
    return {
      coreVendors: [],
      taggedVendors: [],
      hasCompletelyUnknown: true,
      hasTaggedUnknown: false,
      vendors: [],
      hasUnknown: true,
    };
  }

  const feeds = [oracleData.baseFeedOne, oracleData.baseFeedTwo, oracleData.quoteFeedOne, oracleData.quoteFeedTwo];

  const coreVendors = new Set<PriceFeedVendors>();
  const taggedVendors = new Set<string>();
  let hasCompletelyUnknown = false;
  let hasTaggedUnknown = false;

  // Try to get enriched metadata for this oracle
  const oracleMetadata =
    options?.metadataMap && options.oracleAddress ? getOracleFromMetadata(options.metadataMap, options.oracleAddress) : undefined;
  const oracleMetadataData = oracleMetadata?.data && !isMetaOracleData(oracleMetadata.data) ? oracleMetadata.data : undefined;

  for (const feed of feeds) {
    if (feed?.address) {
      // Prefer metadata-based detection
      let feedResult: FeedVendorResult;
      if (oracleMetadataData) {
        const enrichedFeed = getFeedFromOracleData(oracleMetadataData, feed.address);
        feedResult = enrichedFeed ? detectFeedVendorFromMetadata(enrichedFeed) : detectFeedVendor(feed.address, chainId);
      } else {
        feedResult = detectFeedVendor(feed.address, chainId);
      }

      if (feedResult.vendor === PriceFeedVendors.Unknown) {
        // Check if this unknown feed actually has data (tagged by metadata)
        const taggedVendor = feedResult.data?.vendor;
        if (taggedVendor && taggedVendor !== 'Unknown') {
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

  // If we have no feeds with addresses, that should be considered as completely unknown
  const hasFeeds = feeds.some((feed) => feed?.address);
  if (!hasFeeds) {
    hasCompletelyUnknown = true;
  }

  const legacyVendors = Array.from(coreVendors);
  const legacyHasUnknown = hasCompletelyUnknown || hasTaggedUnknown;

  return {
    coreVendors: Array.from(coreVendors),
    taggedVendors: Array.from(taggedVendors),
    hasCompletelyUnknown,
    hasTaggedUnknown,
    vendors: legacyVendors,
    hasUnknown: legacyHasUnknown,
  };
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
        const taggedVendor = feedResult.data?.vendor;
        if (taggedVendor && taggedVendor !== 'Unknown') {
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

  const hasFeeds = feeds.some((feed) => feed?.address);
  if (!hasFeeds) {
    hasCompletelyUnknown = true;
  }

  const legacyVendors = Array.from(coreVendors);
  const legacyHasUnknown = hasCompletelyUnknown || hasTaggedUnknown;

  return {
    coreVendors: Array.from(coreVendors),
    taggedVendors: Array.from(taggedVendors),
    hasCompletelyUnknown,
    hasTaggedUnknown,
    vendors: legacyVendors,
    hasUnknown: legacyHasUnknown,
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
  oracleData: MorphoChainlinkOracleData | null | undefined,
  chainId: number,
  collateralSymbol: string,
  loanSymbol: string,
  options?: ParsePriceFeedVendorsOptions,
): CheckFeedsPathResult {
  if (!oracleData) {
    return { isValid: false, missingPath: 'No oracle data provided' };
  }

  // Get metadata for feed path resolution
  const oracleMetadata =
    options?.metadataMap && options?.oracleAddress ? getOracleFromMetadata(options.metadataMap, options.oracleAddress) : undefined;
  const oracleMetadataData = oracleMetadata?.data && !isMetaOracleData(oracleMetadata.data) ? oracleMetadata.data : undefined;

  const feedPaths: FeedPathEntry[] = [
    { feed: oracleData.baseFeedOne, type: 'base1' as const },
    { feed: oracleData.baseFeedTwo, type: 'base2' as const },
    { feed: oracleData.quoteFeedOne, type: 'quote1' as const },
    { feed: oracleData.quoteFeedTwo, type: 'quote2' as const },
  ].map(({ feed, type }) => ({
    path: getFeedPath(feed, chainId, oracleMetadataData),
    type,
    hasData: !!feed?.address,
  }));

  if (oracleMetadataData?.baseVault?.pair?.length === 2) {
    feedPaths.push({
      path: { base: oracleMetadataData.baseVault.pair[0], quote: oracleMetadataData.baseVault.pair[1] },
      type: 'baseVault',
      hasData: true,
    });
  }
  if (oracleMetadataData?.quoteVault?.pair?.length === 2) {
    feedPaths.push({
      path: { base: oracleMetadataData.quoteVault.pair[0], quote: oracleMetadataData.quoteVault.pair[1] },
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
 * Format seconds into a human-readable duration (e.g. "1h", "24h", "7d")
 */
export function formatOracleDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Helper function to get truncated asset names (max 5 chars)
 */
export function getTruncatedAssetName(asset: string): string {
  return asset.length > 5 ? `${asset.slice(0, 5)}..` : asset;
}
