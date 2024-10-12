import { MorphoChainlinkOracleData } from './types';

type VendorInfo = {
  vendors: string[];
  isUnknown: boolean;
};

export function parseOracleVendors(oracleData: MorphoChainlinkOracleData): VendorInfo {
  const vendors = new Set<string>();
  const feeds = [
    oracleData.baseFeedOne,
    oracleData.baseFeedTwo,
    oracleData.quoteFeedOne,
    oracleData.quoteFeedTwo,
  ];

  feeds.forEach((feed) => {
    if (feed && feed.vendor) {
      if (feed.vendor.toLowerCase() === 'chainlink') {
        vendors.add('Chainlink');
      } else if (feed.vendor.toLowerCase() === 'pyth network') {
        vendors.add('Pyth Network');
      } else {
        vendors.add('Unknown');
      }
    }
  });

  return {
    vendors: Array.from(vendors),
    isUnknown: vendors.has('Unknown') || vendors.size === 0,
  };
}
