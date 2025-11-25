import { Address, Chain, defineChain } from 'viem';
import { arbitrum, base, mainnet, polygon, unichain, monad, hyperEvm as hyperEvmOld } from 'viem/chains';
import { v2AgentsBase } from './monarch-agent';
import { AgentMetadata } from './types';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

export enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42161,
  HyperEVM = 999,
  Monad = 143
}

export const ALL_SUPPORTED_NETWORKS = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Base,
  SupportedNetworks.Polygon,
  SupportedNetworks.Unichain,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.HyperEVM,
  SupportedNetworks.Monad
];

// use hyperevm as custom chain 
export const hyperEvm = defineChain({
  ...hyperEvmOld,
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13051,
    },
  },

})

type VaultAgentConfig = {
  v2FactoryAddress: Address;
  vaultsSubgraphEndpoint?: string // temporary Subgraph to fetch deployed vaults for users
  morphoRegistry: Address; // the RegistryList contract deployed by morpho!
  marketV1AdapterFactory: Address; // MorphoMarketV1AdapterFactory contract used to create adapters for markets
  adapterSubgraphEndpoint?: string;
  strategies?: AgentMetadata[];
};

type NetworkConfig = {
  network: SupportedNetworks;
  logo: string;
  name: string;
  chain: Chain
  defaultRPC: string
  vaultConfig?: VaultAgentConfig;

  // used to estimate block number from blocktime
  blocktime: number;

  // current blocknumber - this number used when trying to find blocks.
  // Make it larger if blockFinder keeps having block find block issues
  maxBlockDelay?: number

  explorerUrl?: string;
  nativeTokenSymbol?: string;
  wrappedNativeToken?: Address;
};


export const networks: NetworkConfig[] = [
  {
    network: SupportedNetworks.Mainnet,
    logo: require('../imgs/chains/eth.svg') as string,
    name: 'Mainnet',
    chain: mainnet,
    defaultRPC: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
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
    defaultRPC: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    vaultConfig: {
      v2FactoryAddress: '0x4501125508079A99ebBebCE205DeC9593C2b5857',
      strategies: v2AgentsBase,
      vaultsSubgraphEndpoint: "https://api.studio.thegraph.com/query/94369/morpho-v-2-vault-factory-base/version/latest",
      morphoRegistry: '0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a',
      marketV1AdapterFactory: '0x133baC94306B99f6dAD85c381a5be851d8DD717c',
      adapterSubgraphEndpoint: "https://api.studio.thegraph.com/query/94369/morpho-adapters/version/latest"
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
    defaultRPC: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
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
    defaultRPC: `https://unichain-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    name: 'Unichain',
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
    defaultRPC: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    blocktime: 2,
    maxBlockDelay: 2,
    explorerUrl: 'https://arbiscan.io',
    wrappedNativeToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  },
  {
    network: SupportedNetworks.HyperEVM,
    chain: hyperEvm,
    logo: require('../imgs/chains/hyperevm.png') as string,
    name: 'HyperEVM',
    defaultRPC: `https://hyperliquid-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    blocktime: 2,
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
    defaultRPC: `https://monad-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    blocktime: 1,
    maxBlockDelay: 5,
    nativeTokenSymbol: 'MON',
    wrappedNativeToken: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    explorerUrl: 'https://monadscan.com',
  }
];

export const isSupportedChain = (chainId: number) => {
  return Object.values(SupportedNetworks).includes(chainId);
};

export const getNetworkConfig = (chainId: SupportedNetworks): NetworkConfig => {
  return networks.find((network) => network.network === chainId) as NetworkConfig;
};

export const getViemChain = (chainId: SupportedNetworks): Chain => {
  return getNetworkConfig(chainId).chain
}

export const getDefaultRPC = (chainId: SupportedNetworks): string => {
  return getNetworkConfig(chainId).defaultRPC
}

export const getBlocktime = (chainId: SupportedNetworks): number => {
  return getNetworkConfig(chainId).blocktime
}

export const getMaxBlockDelay = (chainId: SupportedNetworks): number => {
  return getNetworkConfig(chainId).maxBlockDelay || 0
}

export const isAgentAvailable = (chainId: number): boolean => {
  const network = getNetworkConfig(chainId);
  if (!network || !network.vaultConfig) return false

  return network.vaultConfig.vaultsSubgraphEndpoint !== undefined
};

export const getAgentConfig = (chainId: SupportedNetworks): VaultAgentConfig | undefined => {
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
