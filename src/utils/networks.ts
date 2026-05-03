import { type Address, type Chain, defineChain } from 'viem';
import {
  arbitrum,
  base,
  etherlink as etherlinkChain,
  mainnet,
  monad,
  optimism,
  polygon,
  unichain,
  hyperEvm as hyperEvmOld,
} from 'viem/chains';
import { isSupportedNetwork as isSupportedNetworkValue, SupportedNetworks as SupportedNetworkId } from './supported-networks';
import { v2AgentsBase } from './monarch-agent';
import type { AgentMetadata } from './types';
export { ALL_SUPPORTED_NETWORKS, SupportedNetworks, isSupportedNetwork } from './supported-networks';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const rpcPriority = process.env.NEXT_PUBLIC_RPC_PRIORITY;

const _apiKey = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

/**
 * Helper function to get RPC URL with fallback logic. Priority behavior:
 * - If NEXT_PUBLIC_RPC_PRIORITY === 'ALCHEMY': Use Alchemy first, fall back to specific RPC
 * - Otherwise (default): Use specific network RPC first, fall back to Alchemy
 */
const getRpcUrl = (specificRpcUrl: string | undefined, alchemySubdomain?: string): string => {
  // Sanitize empty strings to undefined for correct fallback behavior
  const targetRpc = specificRpcUrl || undefined;
  const alchemyUrl = alchemyKey && alchemySubdomain ? `https://${alchemySubdomain}.g.alchemy.com/v2/${alchemyKey}` : undefined;

  if (rpcPriority === 'ALCHEMY') {
    // Prioritize Alchemy when explicitly set
    return alchemyUrl ?? targetRpc ?? '';
  }

  // Default: prioritize specific network RPC
  return targetRpc ?? alchemyUrl ?? '';
};

// use hyperevm as custom chain
export const hyperEvm = defineChain({
  ...hyperEvmOld,
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13_051,
    },
  },
});

type VaultAgentConfig = {
  v2FactoryAddress: Address;
  morphoRegistry: Address; // the RegistryList contract deployed by morpho!
  marketAdapterFactory: Address; // MorphoMarketV1AdapterV2Factory used to create adapters for vault markets
  strategies?: AgentMetadata[];
};

type NetworkConfig = {
  network: SupportedNetworkId;
  logo: string;
  name: string;
  chain: Chain;
  defaultRPC: string;
  vaultConfig?: VaultAgentConfig;

  // used to estimate block number from blocktime
  blocktime: number;

  // current blocknumber - this number used when trying to find blocks.
  // Make it larger if blockFinder keeps having block find block issues
  maxBlockDelay?: number;

  // Defaults to true. Set false when an RPC cannot read contract state at historical blocks.
  supportsHistoricalStateRead?: boolean;

  explorerUrl?: string;
  nativeTokenSymbol?: string;
  wrappedNativeToken?: Address;
};

export const networks: NetworkConfig[] = [
  {
    network: SupportedNetworkId.Mainnet,
    logo: require('../imgs/chains/eth.svg') as string,
    name: 'Mainnet',
    chain: mainnet,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_ETHEREUM_RPC, 'eth-mainnet'),
    blocktime: 12,
    maxBlockDelay: 0,
    explorerUrl: 'https://etherscan.io',
    wrappedNativeToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  {
    network: SupportedNetworkId.Optimism,
    logo: require('../imgs/chains/op.svg') as string,
    name: 'Optimism',
    chain: optimism,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_OPTIMISM_RPC, 'opt-mainnet'),
    blocktime: 2,
    maxBlockDelay: 10,
    explorerUrl: 'https://optimistic.etherscan.io/',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
  },
  {
    network: SupportedNetworkId.Base,
    logo: require('../imgs/chains/base.webp') as string,
    name: 'Base',
    chain: base,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_BASE_RPC, 'base-mainnet'),
    vaultConfig: {
      v2FactoryAddress: '0x4501125508079A99ebBebCE205DeC9593C2b5857',
      strategies: v2AgentsBase,
      morphoRegistry: '0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a',
      marketAdapterFactory: '0x9a1B378C43BA535cDB89934230F0D3890c51C0EB',
    },
    blocktime: 2,
    maxBlockDelay: 5,
    explorerUrl: 'https://basescan.org',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
  },
  {
    network: SupportedNetworkId.Polygon,
    chain: polygon,
    logo: require('../imgs/chains/polygon.png') as string,
    name: 'Polygon',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_POLYGON_RPC, 'polygon-mainnet'),
    blocktime: 2,
    maxBlockDelay: 20,
    explorerUrl: 'https://polygonscan.com',
    nativeTokenSymbol: 'POL',
    wrappedNativeToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  },
  {
    network: SupportedNetworkId.Unichain,
    chain: unichain,
    logo: require('../imgs/chains/unichain.svg') as string,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_UNICHAIN_RPC, 'unichain-mainnet'),
    name: 'Unichain',
    blocktime: 1,
    maxBlockDelay: 10,
    explorerUrl: 'https://uniscan.xyz',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
  },
  {
    network: SupportedNetworkId.Arbitrum,
    chain: arbitrum,
    logo: require('../imgs/chains/arbitrum.png') as string,
    name: 'Arbitrum',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_ARBITRUM_RPC, 'arb-mainnet'),
    blocktime: 0.25,
    maxBlockDelay: 2,
    explorerUrl: 'https://arbiscan.io',
    wrappedNativeToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  },
  {
    network: SupportedNetworkId.Etherlink,
    chain: etherlinkChain,
    logo: require('../imgs/chains/etherlink.svg') as string,
    name: 'Etherlink',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_ETHERLINK_RPC),
    blocktime: 4.83,
    maxBlockDelay: 10,
    explorerUrl: 'https://explorer.etherlink.com',
    nativeTokenSymbol: 'XTZ',
    wrappedNativeToken: '0xc9B53AB2679f573e480d01e0f49e2B5CFB7a3EAb',
  },
  {
    network: SupportedNetworkId.HyperEVM,
    chain: hyperEvm,
    logo: require('../imgs/chains/hyperevm.png') as string,
    name: 'HyperEVM',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_HYPEREVM_RPC, 'hyperliquid-mainnet'),
    blocktime: 1,
    maxBlockDelay: 5,
    supportsHistoricalStateRead: false,
    nativeTokenSymbol: 'WHYPE',
    wrappedNativeToken: '0x5555555555555555555555555555555555555555',
    explorerUrl: 'https://hyperevmscan.io',
  },
  {
    network: SupportedNetworkId.Monad,
    chain: monad,
    logo: require('../imgs/chains/monad.svg') as string,
    name: 'Monad',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_MONAD_RPC, 'monad-mainnet'),
    blocktime: 0.4,
    maxBlockDelay: 5,
    nativeTokenSymbol: 'MON',
    wrappedNativeToken: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    explorerUrl: 'https://monadscan.com',
  },
];

export const isSupportedChain = (chainId: number) => {
  return isSupportedNetworkValue(chainId);
};

export const getNetworkConfig = (chainId: SupportedNetworkId): NetworkConfig => {
  return networks.find((network) => network.network === chainId) as NetworkConfig;
};

export const getViemChain = (chainId: SupportedNetworkId): Chain => {
  return getNetworkConfig(chainId).chain;
};

export const getDefaultRPC = (chainId: SupportedNetworkId): string => {
  return getNetworkConfig(chainId).defaultRPC;
};

export const getBlocktime = (chainId: SupportedNetworkId): number => {
  return getNetworkConfig(chainId).blocktime;
};

export const getMaxBlockDelay = (chainId: SupportedNetworkId): number => {
  return getNetworkConfig(chainId).maxBlockDelay || 0;
};

export const supportsHistoricalStateRead = (chainId: number): chainId is SupportedNetworkId => {
  return isSupportedNetworkValue(chainId) && (getNetworkConfig(chainId).supportsHistoricalStateRead ?? true);
};

export const isAgentAvailable = (chainId: number): boolean => {
  const network = getNetworkConfig(chainId);
  if (!network || !network.vaultConfig) return false;

  return true;
};

export const getAgentConfig = (chainId: SupportedNetworkId): VaultAgentConfig | undefined => {
  const network = getNetworkConfig(chainId);
  return network?.vaultConfig;
};

export const getNetworkImg = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.logo;
};

export const getNetworkName = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.name;
};

export const getExplorerUrl = (chainId: SupportedNetworkId): string => {
  return getNetworkConfig(chainId).explorerUrl ?? 'https://etherscan.io';
};

export const getNativeTokenSymbol = (chainId: SupportedNetworkId): string => {
  return getNetworkConfig(chainId).nativeTokenSymbol ?? 'ETH';
};

export const getWrappedNativeToken = (chainId: SupportedNetworkId): Address | undefined => {
  return getNetworkConfig(chainId).wrappedNativeToken;
};

export type { NetworkConfig };
