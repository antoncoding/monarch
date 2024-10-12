import { IoWarningOutline } from 'react-icons/io5';
import { MorphoChainlinkOracleData } from './types';

type VendorInfo = {
  vendors: OracleVendors[];
  isUnknown: boolean;
};

export enum OracleVendors {
  Chainlink = 'Chainlink',
  PythNetwork = 'Pyth network',
  Redstone = 'Redstone',
  Oval = 'Oval',
  Compound = 'Compound',
  Lido = 'Lido',
  Unknown = 'Unknown',
}

export const OracleVendorIcons: Record<OracleVendors, string> = {
  [OracleVendors.Chainlink]: require('../imgs/oracles/chainlink.png'),
  [OracleVendors.PythNetwork]: require('../imgs/oracles/pyth.png'),
  [OracleVendors.Redstone]: require('../imgs/oracles/redstone.png'),
  [OracleVendors.Oval]: require('../imgs/oracles/uma.png'),
  [OracleVendors.Compound]: require('../imgs/oracles/compound.webp'),
  [OracleVendors.Lido]: require('../imgs/oracles/lido.png'),
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
    if (feed && feed.vendor) {
      const knownVendor = Object.values(OracleVendors).find(
        (v) => v.toLowerCase() === feed.vendor?.toLowerCase(),
      );
      vendors.add(knownVendor || OracleVendors.Unknown);
    }
  });

  return {
    vendors: Array.from(vendors),
    isUnknown: vendors.has(OracleVendors.Unknown) || vendors.size === 0,
  };
}
