import { createPublicClient, type PublicClient } from 'viem';
import { arbitrum, base, etherlink, mainnet, monad, optimism, polygon, unichain } from 'viem/chains';
import { getDefaultRPC, getViemChain, SupportedNetworks, hyperEvm, katana } from './networks';
import { createRpcTransport } from './rpc-transport';

// Default clients (cached)
let defaultClients: Partial<Record<SupportedNetworks, PublicClient>> = {};

// Initialize default clients
const initializeDefaultClients = () => {
  if (Object.keys(defaultClients).length === 0) {
    defaultClients = {
      [SupportedNetworks.Mainnet]: createPublicClient({
        chain: mainnet,
        transport: createRpcTransport(SupportedNetworks.Mainnet, getDefaultRPC(SupportedNetworks.Mainnet)),
      }),
      [SupportedNetworks.Optimism]: createPublicClient({
        chain: optimism,
        transport: createRpcTransport(SupportedNetworks.Optimism, getDefaultRPC(SupportedNetworks.Optimism)),
      }) as PublicClient,
      [SupportedNetworks.Base]: createPublicClient({
        chain: base,
        transport: createRpcTransport(SupportedNetworks.Base, getDefaultRPC(SupportedNetworks.Base)),
      }) as PublicClient,
      [SupportedNetworks.Polygon]: createPublicClient({
        chain: polygon,
        transport: createRpcTransport(SupportedNetworks.Polygon, getDefaultRPC(SupportedNetworks.Polygon)),
      }),
      [SupportedNetworks.Unichain]: createPublicClient({
        chain: unichain,
        transport: createRpcTransport(SupportedNetworks.Unichain, getDefaultRPC(SupportedNetworks.Unichain)),
      }) as PublicClient,
      [SupportedNetworks.Arbitrum]: createPublicClient({
        chain: arbitrum,
        transport: createRpcTransport(SupportedNetworks.Arbitrum, getDefaultRPC(SupportedNetworks.Arbitrum)),
      }) as PublicClient,
      [SupportedNetworks.Etherlink]: createPublicClient({
        chain: etherlink,
        transport: createRpcTransport(SupportedNetworks.Etherlink, getDefaultRPC(SupportedNetworks.Etherlink)),
      }) as PublicClient,
      [SupportedNetworks.HyperEVM]: createPublicClient({
        chain: hyperEvm,
        transport: createRpcTransport(SupportedNetworks.HyperEVM, getDefaultRPC(SupportedNetworks.HyperEVM)),
      }) as PublicClient,
      [SupportedNetworks.Monad]: createPublicClient({
        chain: monad,
        transport: createRpcTransport(SupportedNetworks.Monad, getDefaultRPC(SupportedNetworks.Monad)),
      }) as PublicClient,
      [SupportedNetworks.Katana]: createPublicClient({
        chain: katana,
        transport: createRpcTransport(SupportedNetworks.Katana, getDefaultRPC(SupportedNetworks.Katana)),
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
    transport: createRpcTransport(chainId, rpcUrl),
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
