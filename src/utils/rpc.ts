import { createPublicClient, http, PublicClient } from 'viem';
import { arbitrum, base, mainnet, polygon, unichain, monad } from 'viem/chains';
import { getDefaultRPC, getViemChain, SupportedNetworks, hyperEvm } from './networks';

// Default clients (cached)
let defaultClients: Partial<Record<SupportedNetworks, PublicClient>> = {};

// Initialize default clients
const initializeDefaultClients = () => {
  if (Object.keys(defaultClients).length === 0) {
    defaultClients = {
      [SupportedNetworks.Mainnet]: createPublicClient({
        chain: mainnet,
        transport: http(getDefaultRPC(SupportedNetworks.Mainnet)),
      }),
      [SupportedNetworks.Base]: createPublicClient({
        chain: base,
        transport: http(getDefaultRPC(SupportedNetworks.Base)),
      }) as PublicClient,
      [SupportedNetworks.Polygon]: createPublicClient({
        chain: polygon,
        transport: http(getDefaultRPC(SupportedNetworks.Polygon)),
      }),
      [SupportedNetworks.Unichain]: createPublicClient({
        chain: unichain,
        transport: http(getDefaultRPC(SupportedNetworks.Unichain)),
      }) as PublicClient,
      [SupportedNetworks.Arbitrum]: createPublicClient({
        chain: arbitrum,
        transport: http(getDefaultRPC(SupportedNetworks.Arbitrum)),
      }) as PublicClient,
      [SupportedNetworks.HyperEVM]: createPublicClient({
        chain: hyperEvm,
        transport: http(getDefaultRPC(SupportedNetworks.HyperEVM)),
      }) as PublicClient,
      [SupportedNetworks.Monad]: createPublicClient({
        chain: monad,
        transport: http(getDefaultRPC(SupportedNetworks.Monad)),
      }) as PublicClient,
    };
  }
};

// Create a client with custom RPC URL
function createClientWithCustomRpc(
  chainId: SupportedNetworks,
  rpcUrl: string,
): PublicClient {
  const chain = getViemChain(chainId);
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
