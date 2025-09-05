import { zeroAddress, Address } from 'viem';
import {
  getChainlinkOracle,
  ChainlinkOracleEntry,
  isChainlinkOracle,
} from '@/constants/oracle/chainlink-data';
import { getCompoundFeed, CompoundFeedEntry, isCompoundFeed } from '@/constants/oracle/compound';
import { getGeneralFeed, isGeneralFeed, GeneralPriceFeed } from '@/constants/oracle/general-feeds';
import { isSupportedChain } from './networks';
import { MorphoChainlinkOracleData, OracleFeed } from './types';

type VendorInfo = {
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
  if (oracleType === OracleType.Standard) return 'Standard Oracle from Price Feeds';

  return 'Custom Oracle';
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

  if (!oracleData) return { vendors: [], hasUnknown: false };

  if (
    !oracleData.baseFeedOne &&
    !oracleData.baseFeedTwo &&
    !oracleData.quoteFeedOne &&
    !oracleData.quoteFeedTwo
  )
    return { vendors: [], hasUnknown: true };

  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  const vendors = new Set<PriceFeedVendors>();
  let hasUnknown = false;

  for (const feed of feeds) {
    if (feed?.address) {
      const feedResult = detectFeedVendor(feed.address, chainId);
      vendors.add(feedResult.vendor);
      if (feedResult.vendor === PriceFeedVendors.Unknown) {
        hasUnknown = true;
      }
    }
  }

  // If we have no feeds with addresses, that should be considered as having unknown feeds
  const hasFeeds = feeds.some(feed => feed?.address);
  
  return {
    vendors: Array.from(vendors),
    hasUnknown: hasUnknown || !hasFeeds,
  };
}

export function checkFeedsPath(
  oracleData: MorphoChainlinkOracleData | null | undefined,
  chainId: number,
  collateralSymbol: string,
  loanSymbol: string,
): boolean {
  if (!oracleData) return false;

  /**
    Price = Base Feed 1 * Base Feed 2 / Quote Feed 1 * Quote Feed 2
    */

  const baseFee1Path = getFeedPath(oracleData.baseFeedOne, chainId);
  const baseFee2Path = getFeedPath(oracleData.baseFeedTwo, chainId);
  const quoteFee1Path = getFeedPath(oracleData.quoteFeedOne, chainId);
  const quoteFee2Path = getFeedPath(oracleData.quoteFeedTwo, chainId);

  const nominators = [
    baseFee1Path.base,
    baseFee2Path.base,
    quoteFee1Path.quote,
    quoteFee2Path.quote,
  ];
  const denominators = [
    baseFee1Path.quote,
    baseFee2Path.quote,
    quoteFee1Path.base,
    quoteFee2Path.base,
  ];

  // go through each nominator, and try to find thethe same denominator to cancel them out
  let finalBase;
  for (const nominator of nominators) {
    for (const denominator of denominators) {
      if (nominator === denominator) {
      }
    }
    // no matched denominator
  }
  return false;
}

/**
 *
 * @param feed
 * @param chainId
 * @returns { base: "ETH", qutoe: "USD" }
 */
function getFeedPath(
  feed: OracleFeed | null | undefined,
  chainId: number,
): { base: string; quote: string } {
  if (!feed || !feed.address) return { base: 'EMPTY', quote: 'EMPTY' };

  const chainlinkData = getChainlinkOracle(chainId, feed.address);
  if (!chainlinkData) return { base: 'EMPTY', quote: 'EMPTY' };

  return {
    base: chainlinkData.baseAsset.toLowerCase(),
    quote: chainlinkData.quoteAsset.toLowerCase(),
  };
}

// Discriminated union types for feed detection results
export type ChainlinkFeedResult = {
  vendor: PriceFeedVendors.Chainlink;
  data: ChainlinkOracleEntry;
  assetPair: {
    fromAsset: string;
    toAsset: string;
  };
};

export type CompoundFeedResult = {
  vendor: PriceFeedVendors.Compound;
  data: CompoundFeedEntry;
  assetPair: {
    fromAsset: string;
    toAsset: string;
  };
};

export type GeneralFeedResult = {
  vendor:
    | PriceFeedVendors.Redstone
    | PriceFeedVendors.PythNetwork
    | PriceFeedVendors.Oval
    | PriceFeedVendors.Lido;
  data: GeneralPriceFeed;
  assetPair: {
    fromAsset: string;
    toAsset: string;
  };
};

export type UnknownFeedResult = {
  vendor: PriceFeedVendors.Unknown;
  data: GeneralPriceFeed | null;
  assetPair: {
    fromAsset: string;
    toAsset: string;
  };
};

// Discriminated union - ensures vendor and data types are always matched correctly
export type FeedVendorResult =
  | ChainlinkFeedResult
  | CompoundFeedResult
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
          fromAsset: chainlinkData.baseAsset,
          toAsset: chainlinkData.quoteAsset,
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
          fromAsset: compoundData.base,
          toAsset: compoundData.quote,
        },
      } satisfies CompoundFeedResult;
    }
  }

  // Check if it's a general price feed (from various vendors via Morpho's API data)
  if (isGeneralFeed(address, chainId)) {
    const generalFeedData = getGeneralFeed(address, chainId);
    if (generalFeedData) {
      // Map the vendor name from the general feed data to our enum
      const vendorName = generalFeedData.vendor.toLowerCase();

      // Return proper discriminated union based on vendor
      if (vendorName === 'redstone') {
        return {
          vendor: PriceFeedVendors.Redstone,
          data: generalFeedData,
          assetPair: {
            fromAsset: generalFeedData.pair[0],
            toAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      if (vendorName === 'pyth network' || vendorName === 'pyth') {
        return {
          vendor: PriceFeedVendors.PythNetwork,
          data: generalFeedData,
          assetPair: {
            fromAsset: generalFeedData.pair[0],
            toAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      if (vendorName === 'oval') {
        return {
          vendor: PriceFeedVendors.Oval,
          data: generalFeedData,
          assetPair: {
            fromAsset: generalFeedData.pair[0],
            toAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      if (vendorName === 'lido') {
        return {
          vendor: PriceFeedVendors.Lido,
          data: generalFeedData,
          assetPair: {
            fromAsset: generalFeedData.pair[0],
            toAsset: generalFeedData.pair[1],
          },
        } satisfies GeneralFeedResult;
      }

      // For vendors not in our enum (like Pendle), return as unknown but with data
      return {
        vendor: PriceFeedVendors.Unknown,
        data: generalFeedData,
        assetPair: {
          fromAsset: generalFeedData.pair[0],
          toAsset: generalFeedData.pair[1],
        },
      } satisfies UnknownFeedResult;
    }
  }

  // Unknown feed - use fallback pair or default to Unknown
  return {
    vendor: PriceFeedVendors.Unknown,
    data: null,
    assetPair: {
      fromAsset: 'Unknown',
      toAsset: 'Unknown',
    },
  } satisfies UnknownFeedResult;
}

/**
 * Helper function to get truncated asset names (max 5 chars)
 */
export function getTruncatedAssetName(asset: string): string {
  return asset.length > 5 ? asset.slice(0, 5) : asset;
}
