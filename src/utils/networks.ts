import { Address } from 'viem';
import { v2AgentsBase } from './monarch-agent';
import { AgentMetadata } from './types';

enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42161,
}

type VaultAgentConfig = {
  v2FactoryAddress: Address;
  subgraphEndpoint?: string // temporary to allow fetching deployed vaults from subgraph
  strategies?: AgentMetadata[];
};

type NetworkConfig = {
  network: SupportedNetworks;
  logo: string;
  name: string;
  vaultConfig?: VaultAgentConfig;
};


const networks: NetworkConfig[] = [
  {
    network: SupportedNetworks.Mainnet,
    logo: require('../imgs/chains/eth.svg') as string,
    name: 'Mainnet',
  },
  {
    network: SupportedNetworks.Base,
    logo: require('../imgs/chains/base.webp') as string,
    name: 'Base',
    vaultConfig: {
      v2FactoryAddress: '0x4501125508079A99ebBebCE205DeC9593C2b5857',
      strategies: v2AgentsBase,
      subgraphEndpoint: "https://api.studio.thegraph.com/query/94369/morpho-v-2-vault-factory-base/version/latest"
    },
  },
  {
    network: SupportedNetworks.Polygon,
    logo: require('../imgs/chains/polygon.png') as string,
    name: 'Polygon',
  },
  {
    network: SupportedNetworks.Unichain,
    logo: require('../imgs/chains/unichain.svg') as string,
    name: 'Unichain',
  },
  {
    network: SupportedNetworks.Arbitrum,
    logo: require('../imgs/chains/arbitrum.png') as string,
    name: 'Arbitrum',
  },
];

const isSupportedChain = (chainId: number) => {
  return Object.values(SupportedNetworks).includes(chainId);
};

const getNetworkConfig = (chainId: number): NetworkConfig | undefined => {
  return networks.find((network) => network.network === chainId);
};

const isAgentAvailable = (chainId: number): boolean => {
  const network = getNetworkConfig(chainId);
  if (!network || !network.vaultConfig) return false

  return network.vaultConfig.subgraphEndpoint !== undefined
};

const getAgentConfig = (chainId: number): VaultAgentConfig | undefined => {
  const network = getNetworkConfig(chainId);
  return network?.vaultConfig;
};

const getNetworkImg = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.logo;
};

const getNetworkName = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId);
  return target?.name;
};

export {
  SupportedNetworks,
  isSupportedChain,
  getNetworkImg,
  getNetworkName,
  getNetworkConfig,
  getAgentConfig,
  networks,
  isAgentAvailable,
};

export type { NetworkConfig };
