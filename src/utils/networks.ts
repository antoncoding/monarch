import { Address } from 'viem';

enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
  Unichain = 130,
  Arbitrum = 42161,
}

type NetworkAgentConfig = {
  factoryAddress: Address;
  regularRebalancer?: Address;
  rebalanceWindow?: number;
  strategies?: Address[];
};

type NetworkConfig = {
  network: SupportedNetworks;
  logo: string;
  name: string;
  agent?: NetworkAgentConfig;
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
    agent: {
      factoryAddress: '0x0000000000000000000000000000000000000000', // TODO: Set actual factory address
      regularRebalancer: '0x0000000000000000000000000000000000000000', // TODO: Set actual rebalancer
      rebalanceWindow: 3600, // 1 hour in seconds
      strategies: [], // TODO: Add strategy addresses
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
  const config = getNetworkConfig(chainId);
  return !!config?.agent;
};

const getAgentConfig = (chainId: number): NetworkAgentConfig | undefined => {
  const config = getNetworkConfig(chainId);
  return config?.agent;
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

export type { NetworkConfig, NetworkAgentConfig };
