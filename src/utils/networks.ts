import { type Address, type Chain, defineChain } from 'viem';
import { arbitrum, base, mainnet, polygon, unichain, monad, hyperEvm as hyperEvmOld } from 'viem/chains';
import { baseAgents, agents } from './monarch-agent';
import type { AgentMetadata } from './types';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const rpcPriority = process.env.NEXT_PUBLIC_RPC_PRIORITY;

const _apiKey = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

/**
 * Helper function to get RPC URL with fallback logic. Priority behavior:
 * - If NEXT_PUBLIC_RPC_PRIORITY === 'ALCHEMY': Use Alchemy first, fall back to specific RPC
 * - Otherwise (default): Use specific network RPC first, fall back to Alchemy
 */
const getRpcUrl = (specificRpcUrl: string | undefined, alchemySubdomain: string): string => {
  // Sanitize empty strings to undefined for correct fallback behavior
  const targetRpc = specificRpcUrl || undefined;
  const alchemyUrl = alchemyKey ? `https://${alchemySubdomain}.g.alchemy.com/v2/${alchemyKey}` : undefined;

  if (rpcPriority === 'ALCHEMY') {
    // Prioritize Alchemy when explicitly set
    return alchemyUrl ?? targetRpc ?? '';
  }

  // Default: prioritize specific network RPC
  return targetRpc ?? alchemyUrl ?? '';
};

export enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42_161,
  HyperEVM = 999,
  Monad = 143,
}

export const ALL_SUPPORTED_NETWORKS = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Base,
  SupportedNetworks.Polygon,
  SupportedNetworks.Unichain,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.HyperEVM,
  SupportedNetworks.Monad,
];

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
  marketV1AdapterFactory: Address; // MorphoMarketV1AdapterFactory contract used to create adapters for markets
  strategies?: AgentMetadata[];
};

type NetworkConfig = {
  network: SupportedNetworks;
  logo: string;
  name: string;
  chain: Chain;
  defaultRPC: string;
  autovaultAddresses?: VaultAgentConfig;

  // used to estimate block number from blocktime
  blocktime: number;

  // current blocknumber - this number used when trying to find blocks.
  // Make it larger if blockFinder keeps having block find block issues
  maxBlockDelay?: number;

  explorerUrl?: string;
  nativeTokenSymbol?: string;
  wrappedNativeToken?: Address;
};

// Autovault addresses from here: https://docs.morpho.org/get-started/resources/addresses/
// Commented out networks are ones that Morpho GraphQL API doesn't support.
// Mainnet is too expensive to operate on for now. Solution in progress.
export const networks: NetworkConfig[] = [
  {
    network: SupportedNetworks.Mainnet,
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
    network: SupportedNetworks.Base,
    logo: require('../imgs/chains/base.webp') as string,
    name: 'Base',
    chain: base,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_BASE_RPC, 'base-mainnet'),
    autovaultAddresses: {
      v2FactoryAddress: '0x4501125508079A99ebBebCE205DeC9593C2b5857',
      strategies: baseAgents,
      morphoRegistry: '0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a',
      marketV1AdapterFactory: '0x9a1B378C43BA535cDB89934230F0D3890c51C0EB',
    },
    blocktime: 2,
    maxBlockDelay: 5,
    explorerUrl: 'https://basescan.org',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
  },
  {
    network: SupportedNetworks.Polygon,
    chain: polygon,
    logo: require('../imgs/chains/polygon.png') as string,
    name: 'Polygon',
    autovaultAddresses: {
      v2FactoryAddress: '0xC11a53eE9B1eCc7a068D8e40F8F17926584F97Cf',
      strategies: agents,
      morphoRegistry: '0xb70a43821d2707fA9d0EDd9511CC499F468Ba564',
      marketV1AdapterFactory: '0xc0006f52B38625C283dd2f972dD9B779A5851Dd0',
    },
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_POLYGON_RPC, 'polygon-mainnet'),
    blocktime: 2,
    maxBlockDelay: 20,
    explorerUrl: 'https://polygonscan.com',
    nativeTokenSymbol: 'POL',
    wrappedNativeToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  },
  {
    network: SupportedNetworks.Unichain,
    chain: unichain,
    logo: require('../imgs/chains/unichain.svg') as string,
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_UNICHAIN_RPC, 'unichain-mainnet'),
    name: 'Unichain',
    // autovaultAddresses: {
    //   v2FactoryAddress: '0xC9b34c108014B44e5a189A830e7e04c56704a0c9',
    //   strategies: agents,
    //   morphoRegistry: '0xB9130D2A87d7c60ED7E7e4b25bdA6e3E6841becB',
    //   marketV1AdapterFactory: '0x9a13bdA35F98811fbAcf097966b2C838f3F9c58C',
    // },
    blocktime: 1,
    maxBlockDelay: 10,
    explorerUrl: 'https://uniscan.xyz',
    wrappedNativeToken: '0x4200000000000000000000000000000000000006',
  },
  {
    network: SupportedNetworks.Arbitrum,
    chain: arbitrum,
    logo: require('../imgs/chains/arbitrum.png') as string,
    name: 'Arbitrum',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_ARBITRUM_RPC, 'arb-mainnet'),
    // autovaultAddresses: {
    //   v2FactoryAddress: '0x6b46fa3cc9EBF8aB230aBAc664E37F2966Bf7971',
    //   strategies: agents,
    //   morphoRegistry: '0xc00eb3c7aD1aE986A7f05F5A9d71aCa39c763C65',
    //   marketV1AdapterFactory: '0xeF84b1ecEbe43283ec5AF95D7a5c4D7dE0a9859b',
    // },
    blocktime: 0.25,
    maxBlockDelay: 2,
    explorerUrl: 'https://arbiscan.io',
    wrappedNativeToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  },
  {
    network: SupportedNetworks.HyperEVM,
    chain: hyperEvm,
    logo: require('../imgs/chains/hyperevm.png') as string,
    name: 'HyperEVM',
    // autovaultAddresses: {
    //   v2FactoryAddress: '0xD7217E5687FF1071356C780b5fe4803D9D967da7',
    //   strategies: agents,
    //   morphoRegistry: '0x857B55cEb57dA0C2A83EE08a8dB529B931089aee',
    //   marketV1AdapterFactory: '0xaEff6Ef4B7bbfbAadB18b634A8F11392CBeB72Be',
    // },
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_HYPEREVM_RPC, 'hyperliquid-mainnet'),
    blocktime: 1,
    maxBlockDelay: 5,
    nativeTokenSymbol: 'WHYPE',
    wrappedNativeToken: '0x5555555555555555555555555555555555555555',
    explorerUrl: 'https://hyperevmscan.io',
  },
  {
    network: SupportedNetworks.Monad,
    chain: monad,
    logo: require('../imgs/chains/monad.svg') as string,
    name: 'Monad',
    defaultRPC: getRpcUrl(process.env.NEXT_PUBLIC_MONAD_RPC, 'monad-mainnet'),
    autovaultAddresses: {
      v2FactoryAddress: '0x8B2F922162FBb60A6a072cC784A2E4168fB0bb0c',
      strategies: agents,
      morphoRegistry: '0x6a42f8b46224baA4DbBBc2F860F4675eeA7bd52B',
      marketV1AdapterFactory: '0xa00666E86C7e2FA8d2c78d9481E687e098340180',
    },
    blocktime: 0.4,
    maxBlockDelay: 5,
    nativeTokenSymbol: 'MON',
    wrappedNativeToken: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    explorerUrl: 'https://monadscan.com',
  },
];

export const isSupportedChain = (chainId: number) => {
  return Object.values(SupportedNetworks).includes(chainId);
};

export const getNetworkConfig = (chainId: SupportedNetworks): NetworkConfig => {
  return networks.find((network) => network.network === chainId) as NetworkConfig;
};

export const getViemChain = (chainId: SupportedNetworks): Chain => {
  return getNetworkConfig(chainId).chain;
};

export const getDefaultRPC = (chainId: SupportedNetworks): string => {
  return getNetworkConfig(chainId).defaultRPC;
};

export const getBlocktime = (chainId: SupportedNetworks): number => {
  return getNetworkConfig(chainId).blocktime;
};

export const getMaxBlockDelay = (chainId: SupportedNetworks): number => {
  return getNetworkConfig(chainId).maxBlockDelay || 0;
};

export const isAgentAvailable = (chainId: number): boolean => {
  const network = getNetworkConfig(chainId);
  return network?.autovaultAddresses !== undefined;
};

export const getAgentConfig = (chainId: SupportedNetworks): VaultAgentConfig | undefined => {
  const network = getNetworkConfig(chainId);
  return network?.autovaultAddresses;
};

export const getNetworkImg = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.logo;
};

export const getNetworkName = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.name;
};

export const getExplorerUrl = (chainId: SupportedNetworks): string => {
  return getNetworkConfig(chainId).explorerUrl ?? 'https://etherscan.io';
};

export const getNativeTokenSymbol = (chainId: SupportedNetworks): string => {
  return getNetworkConfig(chainId).nativeTokenSymbol ?? 'ETH';
};

export const getWrappedNativeToken = (chainId: SupportedNetworks): Address | undefined => {
  return getNetworkConfig(chainId).wrappedNativeToken;
};

export type { NetworkConfig };
