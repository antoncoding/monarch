import { getChainlinkOracle } from '@/constants/chainlink-data';
import { MorphoChainlinkOracleData, OracleFeed } from './types';

type VendorInfo = {
  vendors: OracleVendors[];
  isUnknown: boolean;
};

export enum OracleVendors {
  Chainlink = 'Chainlink',
  PythNetwork = 'Pyth Network',
  Redstone = 'Redstone',
  Oval = 'Oval',
  Compound = 'Compound',
  Lido = 'Lido',
  Unknown = 'Unknown',
}

export const OracleVendorIcons: Record<OracleVendors, string> = {
  [OracleVendors.Chainlink]: require('../imgs/oracles/chainlink.png') as string,
  [OracleVendors.PythNetwork]: require('../imgs/oracles/pyth.png') as string,
  [OracleVendors.Redstone]: require('../imgs/oracles/redstone.png') as string,
  [OracleVendors.Oval]: require('../imgs/oracles/uma.png') as string,
  [OracleVendors.Compound]: require('../imgs/oracles/compound.webp') as string,
  [OracleVendors.Lido]: require('../imgs/oracles/lido.png') as string,
  [OracleVendors.Unknown]: '',
};

export function parseOracleVendors(
  oracleData: MorphoChainlinkOracleData | null | undefined,
): VendorInfo {
  if (!oracleData) return { vendors: [], isUnknown: false };

  if (
    !oracleData.baseFeedOne &&
    !oracleData.baseFeedTwo &&
    !oracleData.quoteFeedOne &&
    !oracleData.quoteFeedTwo
  )
    return { vendors: [], isUnknown: true };

  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  const vendors = new Set(
    feeds
      .filter((feed) => feed?.vendor)
      .map(
        (feed) =>
          Object.values(OracleVendors).find(
            (v) => v.toLowerCase() === feed!.vendor!.toLowerCase(),
          ) ?? OracleVendors.Unknown,
      ),
  );

  return {
    vendors: Array.from(vendors),
    isUnknown: vendors.has(OracleVendors.Unknown) || vendors.size === 0,
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

  const nominators = [baseFee1Path.base, baseFee2Path.base, quoteFee1Path.quote, quoteFee2Path.quote];
  const denominators = [baseFee1Path.quote, baseFee2Path.quote, quoteFee1Path.base, quoteFee2Path.base];

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
function getFeedPath(feed: OracleFeed | null | undefined, chainId: number): { base: string, quote: string } {
  if (!feed || !feed.address) return { base: "EMPTY", quote: "EMPTY" };

  const chainlinkData = getChainlinkOracle(chainId, feed.address);
  if (!chainlinkData) return { base: "EMPTY", quote: "EMPTY" };

  return { base: chainlinkData.baseAsset.toLowerCase(), quote: chainlinkData.quoteAsset.toLowerCase() };
}