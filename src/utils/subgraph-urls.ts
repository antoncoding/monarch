import { SupportedNetworks } from './networks';

const apiKey = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Ensure the API key is available
if (!apiKey) {
  console.error('NEXT_PUBLIC_THEGRAPH_API_KEY is not set in environment variables.');
}

const baseSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs`
  : undefined;

const mainnetSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs`
  : undefined;

const polygonSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/EhFokmwryNs7qbvostceRqVdjc3petuD13mmdUiMBw8Y`
  : undefined;

const unichainSubgraphUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/ESbNRVHte3nwhcHveux9cK4FFAZK3TTLc5mKQNtpYgmu`
  : undefined;

const arbitrumSubgraph = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/XsJn88DNCHJ1kgTqYeTgHMQSK4LuG1LR75339QVeQ26`
  : undefined;

// Map network IDs (from SupportedNetworks) to Subgraph URLs
export const SUBGRAPH_URLS: Partial<Record<SupportedNetworks, string>> = {
  [SupportedNetworks.Base]: baseSubgraphUrl,
  [SupportedNetworks.Mainnet]: mainnetSubgraphUrl,
  [SupportedNetworks.Polygon]: polygonSubgraphUrl,
  [SupportedNetworks.Unichain]: unichainSubgraphUrl,
  [SupportedNetworks.Arbitrum]: arbitrumSubgraph,
};

export const getSubgraphUrl = (network: SupportedNetworks): string | undefined => {
  return SUBGRAPH_URLS[network];
};
