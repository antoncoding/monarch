import { SupportedNetworks } from '@/utils/networks';

/**
 * Determines the primary data source for market details based on the network.
 */
export const getMarketDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  switch (network) {
    case SupportedNetworks.Mainnet:
      return 'subgraph';
    case SupportedNetworks.Base:
      return 'subgraph';
    default:
      return 'morpho'; // Default to Morpho API
  }
};

/**
 * Determines the data source for historical market data.
 * Assumes only Morpho API provides this, unless explicitly excluded.
 */
export const getHistoricalDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  switch (network) {
    default:
      return 'morpho';
  }
};
