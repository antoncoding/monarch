import { SupportedNetworks } from './networks';

const apiKey = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Ensure the API key is available
if (!apiKey) {
  console.error('NEXT_PUBLIC_THEGRAPH_API_KEY is not set in environment variables.');
  // Potentially throw an error or handle this case as needed
}

const baseSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`
  : undefined;

// TODO: Replace 'YOUR_MAINNET_SUBGRAPH_ID' with the actual Mainnet Subgraph ID
const mainnetSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs`
  : undefined;

// Map network IDs (from SupportedNetworks) to Subgraph URLs
export const SUBGRAPH_URLS: { [key in SupportedNetworks]?: string } = {
  [SupportedNetworks.Base]: baseSubgraphUrl,
  [SupportedNetworks.Mainnet]: mainnetSubgraphUrl,
  // Add other supported networks and their Subgraph URLs here
};

export const getSubgraphUrl = (network: SupportedNetworks): string | undefined => {
  return SUBGRAPH_URLS[network];
}; 