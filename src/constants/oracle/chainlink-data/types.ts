export type ChainlinkOracleEntry = {
  ens: string;
  heartbeat: number;
  path: string;
  proxyAddress: string;
  threshold: number;
  feedCategory: 'low' | 'medium' | 'high' | 'custom';
  baseAsset: string;
  quoteAsset: string;
  isSVR: boolean;
};
