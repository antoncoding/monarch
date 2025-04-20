import { SupportedNetworks } from '@/utils/networks';

/**
 * Determines the primary data source for market details based on the network.
 */
export const getMarketDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  // Use Subgraph for specific networks, Morpho API for others
  switch (network) {
    // Networks using subgraph
    case SupportedNetworks.Mainnet:
    case SupportedNetworks.Base:
      return 'subgraph';
    // Networks using morpho-api
    default:
      return 'morpho'; // Default to Morpho API
  }
};

/**
 * Determines the data source for historical market data.
 * Assumes only Morpho API provides this, unless explicitly excluded.
 */
export const getHistoricalDataSource = (network: SupportedNetworks): 'morpho' | 'subgraph' => {
  // Networks excluded from Morpho API historical data
  // Add networks here if they don't support historical data via Morpho API

  // Assume other networks have historical data via Morpho API
  return 'morpho';
}; 