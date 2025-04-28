enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453,
  Polygon = 137,
}

const isSupportedChain = (chainId: number) => {
  return Object.values(SupportedNetworks).includes(chainId);
};

const agentNetworks = [SupportedNetworks.Base, SupportedNetworks.Polygon];

const isAgentAvailable = (chainId: number) => {
  return agentNetworks.includes(chainId);
};

const networks = [
  {
    network: SupportedNetworks.Mainnet,
    logo: require('../imgs/chains/eth.svg') as string,
    name: 'Mainnet',
  },
  {
    network: SupportedNetworks.Base,
    logo: require('../imgs/chains/base.webp') as string,
    name: 'Base',
  },
  {
    network: SupportedNetworks.Polygon,
    logo: require('../imgs/chains/polygon.png') as string,
    name: 'Polygon',
  },
];

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
  networks,
  isAgentAvailable,
  agentNetworks,
};
