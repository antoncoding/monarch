export enum SupportedNetworks {
  Mainnet = 1,
  Optimism = 10,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42_161,
  Etherlink = 42_793,
  HyperEVM = 999,
  Monad = 143,
}

export const ALL_SUPPORTED_NETWORKS = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Optimism,
  SupportedNetworks.Base,
  SupportedNetworks.Polygon,
  SupportedNetworks.Unichain,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.Etherlink,
  SupportedNetworks.HyperEVM,
  SupportedNetworks.Monad,
];

export const isSupportedNetwork = (chainId: number): chainId is SupportedNetworks => {
  return ALL_SUPPORTED_NETWORKS.includes(chainId as SupportedNetworks);
};

export const NETWORK_SUPPORTS_HISTORICAL_STATE_READ: Record<SupportedNetworks, boolean> = {
  [SupportedNetworks.Mainnet]: true,
  [SupportedNetworks.Optimism]: true,
  [SupportedNetworks.Base]: true,
  [SupportedNetworks.Polygon]: true,
  [SupportedNetworks.Unichain]: true,
  [SupportedNetworks.Arbitrum]: true,
  [SupportedNetworks.Etherlink]: true,
  [SupportedNetworks.HyperEVM]: false,
  [SupportedNetworks.Monad]: true,
};

export const supportsHistoricalStateRead = (chainId: number): chainId is SupportedNetworks => {
  return isSupportedNetwork(chainId) && NETWORK_SUPPORTS_HISTORICAL_STATE_READ[chainId];
};
