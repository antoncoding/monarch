import { SupportedNetworks } from '@/utils/networks';

/**
 * Check if a network supports Morpho API as a data source
 */
export const supportsMorphoApi = (network: SupportedNetworks): boolean => {
  switch (network) {
    case SupportedNetworks.Mainnet:
    case SupportedNetworks.Base:
    case SupportedNetworks.Unichain:
    case SupportedNetworks.Polygon:
    case SupportedNetworks.Arbitrum:
    case SupportedNetworks.HyperEVM:
      return true;

    default:
      return false;
  }
};
