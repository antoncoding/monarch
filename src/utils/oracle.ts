import { zeroAddress, Address } from 'viem';
import {
  getChainlinkOracle,
  ChainlinkOracleEntry,
  isChainlinkOracle,
} from '@/constants/oracle/chainlink-data';
import {
  getRedstoneOracle,
  RedstoneOracleEntry,
  isRedstoneOracle,
} from '@/constants/oracle/redstone-data';
import { getCompoundFeed, CompoundFeedEntry, isCompoundFeed } from '@/constants/oracle/compound';
import { getGeneralFeed, isGeneralFeed, GeneralPriceFeed } from '@/constants/oracle/general-feeds';
import { isSupportedChain } from './networks';
import { MorphoChainlinkOracleData, OracleFeed } from './types';

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
}

export enum PriceFeedVendors {
  Chainlink = 'Chainlink',
  PythNetwork = 'Pyth Network',
  Redstone = 'Redstone',
  Oval = 'Oval',
  Compound = 'Compound',
  Lido = 'Lido',
  Unknown = 'Unknown',
}

export const OracleVendorIcons: Record<PriceFeedVendors, string> = {
  [PriceFeedVendors.Chainlink]: require('../imgs/oracles/chainlink.png') as string,
  [PriceFeedVendors.PythNetwork]: require('../imgs/oracles/pyth.png') as string,
  [PriceFeedVendors.Redstone]: require('../imgs/oracles/redstone.png') as string,
  [PriceFeedVendors.Oval]: require('../imgs/oracles/uma.png') as string,
  [PriceFeedVendors.Compound]: require('../imgs/oracles/compound.webp') as string,
  [PriceFeedVendors.Lido]: require('../imgs/oracles/lido.png') as string,
  [PriceFeedVendors.Unknown]: '',
};

export function getOracleTypeDescription(oracleType: OracleType): string {
  if (oracleType === OracleType.Standard) return 'Standard Oracle';

  return 'Custom Oracle';
}

// Discriminated union types for feed detection results
export type ChainlinkFeedResult = {
  vendor: PriceFeedVendors.Chainlink;
  data: ChainlinkOracleEntry;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

export type CompoundFeedResult = {
  vendor: PriceFeedVendors.Compound;
  data: CompoundFeedEntry;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

export type RedstoneFeedResult = {
  vendor: PriceFeedVendors.Redstone;
  data: RedstoneOracleEntry;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

export type GeneralFeedResult = {
  vendor: PriceFeedVendors.PythNetwork | PriceFeedVendors.Oval | PriceFeedVendors.Lido;
  data: GeneralPriceFeed;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

export type UnknownFeedResult = {
  vendor: PriceFeedVendors.Unknown;
  data: GeneralPriceFeed | null;
  assetPair: {
    baseAsset: string;
    quoteAsset: string;
  };
};

// Discriminated union - ensures vendor and data types are always matched correctly
export type FeedVendorResult =
  | ChainlinkFeedResult
  | CompoundFeedResult
  | RedstoneFeedResult
  | GeneralFeedResult
  | UnknownFeedResult;

/**
 * Centralized function to detect feed vendor and retrieve corresponding data
 * @param feedAddress - The feed contract address
 * @param chainId - The chain ID
 * @returns FeedVendorResult with vendor, data, and asset pair information
 */
export function detectFeedVendor(feedAddress: Address | string, chainId: number): FeedVendorResult {
  const address = feedAddress as Address;

  // Check if it's a Chainlink feed
  if (isChainlinkOracle(chainId, address)) {
    const chainlinkData = getChainlinkOracle(chainId, address);
    if (chainlinkData) {
      return {
        vendor: PriceFeedVendors.Chainlink,
        data: chainlinkData,
        assetPair: {
          baseAsset: chainlinkData.baseAsset,
          quoteAsset: chainlinkData.quoteAsset,
        },
      } satisfies ChainlinkFeedResult;
    }
  }

  // Check if it's a Compound feed
  if (isCompoundFeed(address)) {
    const compoundData = getCompoundFeed(address);
    if (compoundData) {
      return {
        vendor: PriceFeedVendors.Compound,
        data: compoundData,
        assetPair: {
          baseAsset: compoundData.base,
          quoteAsset: compoundData.quote,
        },
      } satisfies CompoundFeedResult;
    }
  }

  // Check if it's a Redstone feed
  if (isRedstoneOracle(chainId, address)) {
    const redstoneData = getRedstoneOracle(chainId, address);
    if (redstoneData) {
      // Parse path to get base and quote assets (e.g., "btc/usd" -> ["btc", "usd"])
      const [baseAsset, quoteAsset] = redstoneData.path.split('/').map((s) => s.toUpperCase());
      return {
        vendor: PriceFeedVendors.Redstone,
        data: redstoneData,
        assetPair: {
          baseAsset: baseAsset ?? 'Unknown',
          quoteAsset: quoteAsset ?? 'Unknown',
        },
      } satisfies RedstoneFeedResult;
    }
  }

  // Check if it's a general price feed (from various vendors via Morpho's API data)
  if (isGeneralFeed(address, chainId)) {
    const generalFeedData = getGeneralFeed(address, chainId);
    if (generalFeedData) {
      // Map the vendor name from the general feed data to our enum
      const vendorName = generalFeedData.vendor.toLowerCase();

      // Return proper discriminated union based on vendor
      // Note: Redstone is now handled separately above with our own data

      if (vendorName === 'pyth network' || vendorName === 'pyth') {
        return {
          vendor: PriceFeedVendors.PythNetwork,
          data: generalFeedData,
          assetPair: {
            baseAsset: generalFeedData.pair[0],
            quoteAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      if (vendorName === 'oval') {
        return {
          vendor: PriceFeedVendors.Oval,
          data: generalFeedData,
          assetPair: {
            baseAsset: generalFeedData.pair[0],
            quoteAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      if (vendorName === 'lido') {
        return {
          vendor: PriceFeedVendors.Lido,
          data: generalFeedData,
          assetPair: {
            baseAsset: generalFeedData.pair[0],
            quoteAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      // For vendors not in our enum (like Pendle), return as unknown but with data
      return {
        vendor: PriceFeedVendors.Unknown,
        data: generalFeedData,
        assetPair: {
          baseAsset: generalFeedData.pair[0],
          quoteAsset: generalFeedData.pair[1],
        },
      } satisfies UnknownFeedResult;
    }
  }

  // Unknown feed - use fallback pair or default to Unknown
  return {
    vendor: PriceFeedVendors.Unknown,
    data: null,
    assetPair: {
      baseAsset: 'Unknown',
      quoteAsset: 'Unknown',
    },
  } satisfies UnknownFeedResult;
}

/**
 *
 * @param feed
 * @param chainId
 * @returns { base: "ETH", quote: "USD" }
 */
function getFeedPath(
  feed: OracleFeed | null | undefined,
  chainId: number,
): { base: string; quote: string } {
  if (!feed || !feed.address) return { base: 'EMPTY', quote: 'EMPTY' };

  const data = detectFeedVendor(feed.address, chainId);
  const base = data.assetPair.baseAsset || 'Unknown';
  const quote = data.assetPair.quoteAsset || 'Unknown';
  return { base, quote };
}

export function getOracleType(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  oracleAddress?: string,
  chainId?: number,
) {
  // Morpho API only contains oracleData if it follows the standard MorphoOracle structure with feeds
  if (!oracleData) return OracleType.Custom;

  if (
    oracleData.baseFeedOne !== null ||
    oracleData.baseFeedTwo !== null ||
    oracleData.quoteFeedOne !== null ||
    oracleData.quoteFeedTwo !== null
  )
    return OracleType.Standard;

  // Other logics to determin oracle types
  if (oracleAddress === zeroAddress || (chainId && isSupportedChain(chainId)))
    return OracleType.Custom;
  return OracleType.Custom;
}

export function parsePriceFeedVendors(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  chainId: number,
): VendorInfo {
  if (!oracleData) {
    return {
      coreVendors: [],
      taggedVendors: [],
      hasCompletelyUnknown: false,
      hasTaggedUnknown: false,
      // Legacy properties
      vendors: [],
      hasUnknown: false,
    };
  }

  if (
    !oracleData.baseFeedOne &&
    !oracleData.baseFeedTwo &&
    !oracleData.quoteFeedOne &&
    !oracleData.quoteFeedTwo
  ) {
    return {
      coreVendors: [],
      taggedVendors: [],
      hasCompletelyUnknown: true,
      hasTaggedUnknown: false,
      // Legacy properties
      vendors: [],
      hasUnknown: true,
    };
  }

  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  const coreVendors = new Set<PriceFeedVendors>();
  const taggedVendors = new Set<string>();
  let hasCompletelyUnknown = false;
  let hasTaggedUnknown = false;

  for (const feed of feeds) {
    if (feed?.address) {
      const feedResult = detectFeedVendor(feed.address, chainId);

      if (feedResult.vendor === PriceFeedVendors.Unknown) {
        // Check if this unknown feed actually has data (tagged by Morpho)
        if (feedResult.data) {
          // It's tagged by Morpho but not in our core vendors enum
          taggedVendors.add(feedResult.data.vendor);
          hasTaggedUnknown = true;
        } else {
          // Completely unknown feed
          hasCompletelyUnknown = true;
        }
      } else {
        // It's a core vendor
        coreVendors.add(feedResult.vendor);
      }
    }
  }

  // If we have no feeds with addresses, that should be considered as completely unknown
  const hasFeeds = feeds.some((feed) => feed?.address);
  if (!hasFeeds) {
    hasCompletelyUnknown = true;
  }

  // Legacy support - combine all vendors for backward compatibility
  const legacyVendors = Array.from(coreVendors);
  const legacyHasUnknown = hasCompletelyUnknown || hasTaggedUnknown;

  return {
    coreVendors: Array.from(coreVendors),
    taggedVendors: Array.from(taggedVendors),
    hasCompletelyUnknown,
    hasTaggedUnknown,
    // Legacy properties for backward compatibility
    vendors: legacyVendors,
    hasUnknown: legacyHasUnknown,
  };
}

type CheckFeedsPathResult = {
  isValid: boolean;
  hasUnknownFeed?: boolean;
  missingPath?: string;
  expectedPath?: string;
};

/**
 * Normalize asset symbols for comparison
 * - Convert to lowercase
 * - Map WETH to ETH for equivalency
 */
function normalizeSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase();
  return normalized === 'weth' ? 'eth' : normalized;
}

export function checkFeedsPath(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  chainId: number,
  collateralSymbol: string,
  loanSymbol: string,
): CheckFeedsPathResult {
  if (!oracleData) {
    return {
      isValid: false,
      missingPath: 'No oracle data provided',
    };
  }

  /**
   * Price calculation: baseFeed1 * baseFeed2 / (quoteFeed1 * quoteFeed2)
   * Each feed represents baseAsset/quoteAsset
   * Final formula: (baseFeed1.base * baseFeed2.base * quoteFeed1.quote * quoteFeed2.quote) /
   *                (baseFeed1.quote * baseFeed2.quote * quoteFeed1.base * quoteFeed2.base)
   */

  const feeds = [
    { feed: oracleData.baseFeedOne, type: 'base1' as const },
    { feed: oracleData.baseFeedTwo, type: 'base2' as const },
    { feed: oracleData.quoteFeedOne, type: 'quote1' as const },
    { feed: oracleData.quoteFeedTwo, type: 'quote2' as const },
  ];

  // Check for unknown or empty feeds
  const feedPaths = feeds.map(({ feed, type }) => {
    const path = getFeedPath(feed, chainId);
    return { path, type, hasData: !!feed?.address };
  });

  // Check for unknown assets
  const hasUnknownAssets = feedPaths.some(
    ({ path }) => path.base === 'Unknown' || path.quote === 'Unknown',
  );

  if (hasUnknownAssets) {
    return {
      isValid: false,
      hasUnknownFeed: true,
    };
  }

  // Count asset occurrences in numerator and denominator
  const numeratorCounts = new Map<string, number>();
  const denominatorCounts = new Map<string, number>();

  // Helper function to increment count with normalized symbols
  const incrementCount = (map: Map<string, number>, asset: string) => {
    if (asset !== 'EMPTY') {
      const normalizedAsset = normalizeSymbol(asset);
      map.set(normalizedAsset, (map.get(normalizedAsset) ?? 0) + 1);
    }
  };

  feedPaths.forEach(({ path, type, hasData }) => {
    if (!hasData) return;

    if (type === 'base1' || type === 'base2') {
      // For base feeds: base goes to numerator, quote goes to denominator
      incrementCount(numeratorCounts, path.base);
      incrementCount(denominatorCounts, path.quote);
    } else {
      // For quote feeds: base goes to denominator, quote goes to numerator
      incrementCount(denominatorCounts, path.base);
      incrementCount(numeratorCounts, path.quote);
    }
  });

  // Cancel out matching terms
  const cancelOut = (num: Map<string, number>, den: Map<string, number>) => {
    const assets = new Set([...num.keys(), ...den.keys()]);

    for (const asset of assets) {
      const numCount = num.get(asset) ?? 0;
      const denCount = den.get(asset) ?? 0;
      const minCount = Math.min(numCount, denCount);

      if (minCount > 0) {
        num.set(asset, numCount - minCount);
        den.set(asset, denCount - minCount);

        // Remove zeros
        if (num.get(asset) === 0) num.delete(asset);
        if (den.get(asset) === 0) den.delete(asset);
      }
    }
  };

  cancelOut(numeratorCounts, denominatorCounts);

  // Check if remaining terms match expected collateral/loan path
  const remainingNumeratorAssets = Array.from(numeratorCounts.keys()).filter(
    (asset) => (numeratorCounts.get(asset) ?? 0) > 0,
  );
  const remainingDenominatorAssets = Array.from(denominatorCounts.keys()).filter(
    (asset) => (denominatorCounts.get(asset) ?? 0) > 0,
  );

  // Normalize the expected collateral and loan symbols for comparison
  const normalizedCollateralSymbol = normalizeSymbol(collateralSymbol);
  const normalizedLoanSymbol = normalizeSymbol(loanSymbol);

  const expectedPath = `${normalizedCollateralSymbol}/${normalizedLoanSymbol}`;

  // Perfect match: exactly one asset in numerator (collateral) and one in denominator (loan)
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

  // Generate helpful error message
  let missingPath = '';
  if (remainingNumeratorAssets.length === 0 && remainingDenominatorAssets.length === 0) {
    missingPath = 'All assets canceled out - no price path found';
  } else {
    const actualPath = `${remainingNumeratorAssets.join('*')}/${remainingDenominatorAssets.join(
      '*',
    )}`;
    missingPath = `Feed path mismatch: got ${actualPath}, expected ${expectedPath}`;
  }

  return {
    isValid: false,
    missingPath,
    expectedPath,
  };
}

/**
 * Helper function to get truncated asset names (max 5 chars)
 */
export function getTruncatedAssetName(asset: string): string {
  return asset.length > 5 ? asset.slice(0, 5) + '..' : asset;
}
