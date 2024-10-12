import { MorphoChainlinkOracleData } from './types';

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

export function parseOracleVendors(oracleData: MorphoChainlinkOracleData | null): VendorInfo {
  if (!oracleData) return { vendors: [], isUnknown: false };
  if (
    !oracleData.baseFeedOne &&
    !oracleData.baseFeedTwo &&
    !oracleData.quoteFeedOne &&
    !oracleData.quoteFeedTwo
  )
    return { vendors: [], isUnknown: true };

  const vendors = new Set<OracleVendors>();
  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  feeds.forEach((feed) => {
    if (feed?.vendor) {
      const knownVendor = Object.values(OracleVendors).find(
        (v) => v.toLowerCase() === feed.vendor?.toLowerCase(),
      );
      vendors.add(knownVendor ?? OracleVendors.Unknown);
    }
  });

  return {
    vendors: Array.from(vendors),
    isUnknown: vendors.has(OracleVendors.Unknown) || vendors.size === 0,
  };
}
