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
  if (!oracleData) return { vendors: [], isUnknown: true };

  const vendors = new Set<OracleVendors>();
  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  feeds.forEach((feed) => {
    if (feed && feed.vendor) {
      switch (feed.vendor) {
        case OracleVendors.Chainlink:
          vendors.add(OracleVendors.Chainlink);
          break;
        case OracleVendors.PythNetwork:
          vendors.add(OracleVendors.PythNetwork);
          break;
        case OracleVendors.Redstone:
          vendors.add(OracleVendors.Redstone);
          break;
        case OracleVendors.Oval:
          vendors.add(OracleVendors.Oval);
          break;
        default:
          vendors.add(OracleVendors.Unknown);
      }
    }
  });

  return {
    vendors: Array.from(vendors),
    isUnknown: vendors.has(OracleVendors.Unknown) || vendors.size === 0,
  };
}
