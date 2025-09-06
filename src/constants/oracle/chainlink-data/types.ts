export type ChainlinkOracleEntry = {
  contractAddress: string;
  contractVersion: number;
  ens: string;
  heartbeat: number;
  multiply: string;
  name: string;
  path: string;
  proxyAddress: string;
  threshold: number;
  valuePrefix: string;
  assetName: string;
  feedCategory: 'low' | 'medium' | 'high' | 'custom';
  feedType: string;
  decimals: number;
  baseAsset: string;
  quoteAsset: string;
  isSVR: boolean;
};
