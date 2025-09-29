import { Address, Chain, defineChain } from 'viem';
import { v2AgentsBase } from './monarch-agent';
import { AgentMetadata } from './types';
import { arbitrum, base, mainnet, polygon, unichain } from 'viem/chains';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

export enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42161,
  HyperEVM = 999
}


// use hyperevm as costom chain 
export const hyperevm = defineChain({
  id: 999,
  name: 'Hyperevm',
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.hypurrscan.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVMScan',
      url: 'https://hyperevmscan.io/',
      apiUrl: 'https://api.hyperevmscan.io/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13051,
    },
  },

})

type VaultAgentConfig = {
  v2FactoryAddress: Address;
  subgraphEndpoint?: string // temporary to allow fetching deployed vaults from subgraph
  strategies?: AgentMetadata[];
};

type NetworkConfig = {
  network: SupportedNetworks;
  logo: string;
  name: string;
  chain: Chain
  defaultRPC: string
  vaultConfig?: VaultAgentConfig;
};


export const networks: NetworkConfig[] = [
  {
    network: SupportedNetworks.Mainnet,
    logo: require('../imgs/chains/eth.svg') as string,
    name: 'Mainnet',
    chain: mainnet,
    defaultRPC: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
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
      subgraphEndpoint: "https://api.studio.thegraph.com/query/94369/morpho-v-2-vault-factory-base/version/latest"
    },
  },
  {
    network: SupportedNetworks.Polygon,
    chain: polygon,
    logo: require('../imgs/chains/polygon.png') as string,
    name: 'Polygon',
    defaultRPC: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  },
  {
    network: SupportedNetworks.Unichain,
    chain: unichain,
    logo: require('../imgs/chains/unichain.svg') as string,
    defaultRPC: `https://unichain-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    name: 'Unichain',
  },
  {
    network: SupportedNetworks.Arbitrum,
    chain: arbitrum,
    logo: require('../imgs/chains/arbitrum.png') as string,
    name: 'Arbitrum',
    defaultRPC: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`
  },
  {
    network: SupportedNetworks.HyperEVM,
    chain: hyperevm,
    logo: require('../imgs/chains/hyperevm.png') as string,
    name: 'Arbitrum',
    defaultRPC: `https://hyperliquid-mainnet.g.alchemy.com/v2/${alchemyKey}`
  },
];

// Default RPC URLs
// export const DEFAULT_RPC_URLS = {
//   [SupportedNetworks.Mainnet]: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
//   [SupportedNetworks.Base]: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
//   [SupportedNetworks.Polygon]: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
//   [SupportedNetworks.Unichain]: `https://unichain-mainnet.g.alchemy.com/v2/${alchemyKey}`,
//   [SupportedNetworks.Arbitrum]: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,

// } as const;

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

export const isAgentAvailable = (chainId: number): boolean => {
  const network = getNetworkConfig(chainId);
  if (!network || !network.vaultConfig) return false

  return network.vaultConfig.subgraphEndpoint !== undefined
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

export type { NetworkConfig };
