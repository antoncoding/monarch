import { SupportedNetworks } from '@/utils/networks';

/**
 * Determines the primary data source for market details based on the network.
 */
export const getMarketDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  switch (network) {
    case SupportedNetworks.Mainnet:
      return 'morpho';
    case SupportedNetworks.Base:
      return 'morpho';
    default:
      return 'subgraph'; // Default to Subgraph
  }
};

/**
 * Determines the data source for historical market data.
 * Assumes only Morpho API provides this, unless explicitly excluded.
 */
export const getHistoricalDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  switch (network) {
    case SupportedNetworks.Mainnet:
      return 'morpho';
    case SupportedNetworks.Base:
      return 'morpho';
    default:
      return 'subgraph';
  }
};

/**
 * Check if a network supports Morpho API as a data source
 */
export const supportsMorphoApi = (network: SupportedNetworks): boolean => {
  switch (network) {
    case SupportedNetworks.Mainnet:
    case SupportedNetworks.Base:
      return true;
    default:
      return false;
  }
};
