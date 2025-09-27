import { createPublicClient, http, PublicClient } from 'viem';
import { arbitrum, base, mainnet, polygon, unichain } from 'viem/chains';
import { SupportedNetworks } from './networks';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Default RPC URLs
export const DEFAULT_RPC_URLS = {
  [SupportedNetworks.Mainnet]: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  [SupportedNetworks.Base]: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  [SupportedNetworks.Polygon]: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  [SupportedNetworks.Unichain]: `https://unichain-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  [SupportedNetworks.Arbitrum]: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
} as const;

// Chain configurations
export const CHAIN_CONFIGS = {
  [SupportedNetworks.Mainnet]: mainnet,
  [SupportedNetworks.Base]: base,
  [SupportedNetworks.Polygon]: polygon,
  [SupportedNetworks.Unichain]: unichain,
  [SupportedNetworks.Arbitrum]: arbitrum,
} as const;

// Default clients (cached)
let defaultClients: Partial<Record<SupportedNetworks, PublicClient>> = {};

// Initialize default clients
const initializeDefaultClients = () => {
  if (Object.keys(defaultClients).length === 0) {
    defaultClients = {
      [SupportedNetworks.Mainnet]: createPublicClient({
        chain: mainnet,
        transport: http(DEFAULT_RPC_URLS[SupportedNetworks.Mainnet]),
      }),
      [SupportedNetworks.Base]: createPublicClient({
        chain: base,
        transport: http(DEFAULT_RPC_URLS[SupportedNetworks.Base]),
      }) as PublicClient,
      [SupportedNetworks.Polygon]: createPublicClient({
        chain: polygon,
        transport: http(DEFAULT_RPC_URLS[SupportedNetworks.Polygon]),
      }),
      [SupportedNetworks.Unichain]: createPublicClient({
        chain: unichain,
        transport: http(DEFAULT_RPC_URLS[SupportedNetworks.Unichain]),
      }) as PublicClient,
      [SupportedNetworks.Arbitrum]: createPublicClient({
        chain: arbitrum,
        transport: http(DEFAULT_RPC_URLS[SupportedNetworks.Arbitrum]),
      }) as PublicClient,
    };
  }
};

// Create a client with custom RPC URL
export function createClientWithCustomRpc(
  chainId: SupportedNetworks,
  rpcUrl: string,
): PublicClient {
  const chain = CHAIN_CONFIGS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient;
}

// Get client with optional custom RPC URL
export const getClient = (chainId: SupportedNetworks, customRpcUrl?: string): PublicClient => {
  if (customRpcUrl) {
    return createClientWithCustomRpc(chainId, customRpcUrl);
  }

  initializeDefaultClients();
  const client = defaultClients[chainId];
  if (!client) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }
  return client;
};

export const BLOCK_TIME = {
  [SupportedNetworks.Mainnet]: 12, // Ethereum mainnet: 12 seconds
  [SupportedNetworks.Base]: 2, // Base: 2 seconds
  [SupportedNetworks.Polygon]: 2, // Polygon: 2 seconds
  [SupportedNetworks.Unichain]: 1, // Unichain: 2 seconds
  [SupportedNetworks.Arbitrum]: 2,
} as const;

export const GENESIS_BLOCK = {
  [SupportedNetworks.Mainnet]: 18883124, // Ethereum mainnet
  [SupportedNetworks.Base]: 13977148, // Base
  [SupportedNetworks.Polygon]: 66931042, // Polygon
  [SupportedNetworks.Unichain]: 9139027, // Unichain
  [SupportedNetworks.Arbitrum]: 296446593, // Arbitrum
} as const;

export const LATEST_BLOCK_DELAY = {
  [SupportedNetworks.Mainnet]: 0, // Ethereum mainnet
  [SupportedNetworks.Base]: 20, // Base
  [SupportedNetworks.Polygon]: 20, // Polygon
  [SupportedNetworks.Unichain]: 20, // Unichain
  [SupportedNetworks.Arbitrum]: 20,
};

type BlockResponse = {
  blockNumber: string;
  timestamp: number;
  approximateBlockTime: number;
};

export async function estimatedBlockNumber(
  chainId: SupportedNetworks,
  timestamp: number,
): Promise<{
  blockNumber: number;
  timestamp: number;
}> {
  const fetchBlock = async () => {
    const blockResponse = await fetch(
      `/api/block?` +
        `timestamp=${encodeURIComponent(timestamp)}` +
        `&chainId=${encodeURIComponent(chainId)}`,
    );

    if (!blockResponse.ok) {
      const errorData = (await blockResponse.json()) as { error?: string };
      console.error('Failed to find nearest block:', errorData);
      throw new Error('Failed to find nearest block');
    }

    const blockData = (await blockResponse.json()) as BlockResponse;
    console.log('Found nearest block:', blockData);

    return {
      blockNumber: Number(blockData.blockNumber),
      timestamp: Number(blockData.timestamp),
    };
  };

  try {
    return await fetchBlock();
  } catch (error) {
    console.log('First attempt failed, retrying in 2 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await fetchBlock();
  }
}
