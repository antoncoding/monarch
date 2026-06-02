import { ALL_SUPPORTED_NETWORKS, isSupportedNetwork, SupportedNetworks } from '@/utils/supported-networks';

/**
 * Check if a network supports Morpho API as a data source
 */
export const supportsMorphoApi = (network: SupportedNetworks): boolean => {
  switch (network) {
    case SupportedNetworks.Mainnet:
    case SupportedNetworks.Optimism:
    case SupportedNetworks.Base:
    case SupportedNetworks.Unichain:
    case SupportedNetworks.Polygon:
    case SupportedNetworks.Arbitrum:
    case SupportedNetworks.HyperEVM:
    case SupportedNetworks.Monad:
      return true;

    default:
      return false;
  }
};

export const supportsMorphoApiChainId = (chainId: number): chainId is SupportedNetworks => {
  return isSupportedNetwork(chainId) && supportsMorphoApi(chainId);
};

export const MORPHO_API_SUPPORTED_NETWORKS = ALL_SUPPORTED_NETWORKS.filter((network) => supportsMorphoApi(network));
