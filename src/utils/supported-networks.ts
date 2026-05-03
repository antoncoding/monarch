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
