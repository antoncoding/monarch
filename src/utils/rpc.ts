import { createPublicClient, http, type PublicClient } from 'viem';
import { arbitrum, base, mainnet, polygon, unichain, monad } from 'viem/chains';
import { getDefaultRPC, getViemChain, SupportedNetworks, hyperEvm } from './networks';

// Default clients (cached)
let defaultClients: Partial<Record<SupportedNetworks, PublicClient>> = {};
const customClients = new Map<string, PublicClient>();

const RPC_BATCH_WAIT_MS = 16;
const RPC_BATCH_SIZE = 1000;

const createHttpTransport = (url: string) =>
  http(url, {
    batch: {
      batchSize: RPC_BATCH_SIZE,
      wait: RPC_BATCH_WAIT_MS,
    },
  });

// Initialize default clients
const initializeDefaultClients = () => {
  if (Object.keys(defaultClients).length === 0) {
    defaultClients = {
      [SupportedNetworks.Mainnet]: createPublicClient({
        chain: mainnet,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Mainnet)),
      }),
      [SupportedNetworks.Base]: createPublicClient({
        chain: base,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Base)),
      }) as PublicClient,
      [SupportedNetworks.Polygon]: createPublicClient({
        chain: polygon,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Polygon)),
      }),
      [SupportedNetworks.Unichain]: createPublicClient({
        chain: unichain,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Unichain)),
      }) as PublicClient,
      [SupportedNetworks.Arbitrum]: createPublicClient({
        chain: arbitrum,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Arbitrum)),
      }) as PublicClient,
      [SupportedNetworks.HyperEVM]: createPublicClient({
        chain: hyperEvm,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.HyperEVM)),
      }) as PublicClient,
      [SupportedNetworks.Monad]: createPublicClient({
        chain: monad,
        transport: createHttpTransport(getDefaultRPC(SupportedNetworks.Monad)),
      }) as PublicClient,
    };
  }
};

// Create a client with custom RPC URL
function createClientWithCustomRpc(chainId: SupportedNetworks, rpcUrl: string): PublicClient {
  const chain = getViemChain(chainId);
  if (!chain) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: createHttpTransport(rpcUrl),
  }) as PublicClient;
}

// Get client with optional custom RPC URL
export const getClient = (chainId: SupportedNetworks, customRpcUrl?: string): PublicClient => {
  if (customRpcUrl) {
    const cacheKey = `${chainId}:${customRpcUrl}`;
    const cachedClient = customClients.get(cacheKey);

    if (cachedClient) {
      return cachedClient;
    }

    const client = createClientWithCustomRpc(chainId, customRpcUrl);
    customClients.set(cacheKey, client);
    return client;
  }

  initializeDefaultClients();
  const client = defaultClients[chainId];
  if (!client) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }
  return client;
};
