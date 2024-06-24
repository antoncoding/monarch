enum SupportedNetworks {
  Mainnet = 1,
  Base = 8453
}

const isSupportedChain = (chainId: number) => {
  return Object.values(SupportedNetworks).includes(chainId)
}

const networks = [{
  network: SupportedNetworks.Mainnet,
  logo: require('../imgs/chains/eth.svg') as string,
  name: 'Mainnet'
}, {
  network: SupportedNetworks.Base,
  logo: require('../imgs/chains/base.webp') as string,
  name: 'Base'
}]

const getNetworkImg = (chainId: number) => {
  const target = networks.find((network) => network.network === chainId)
  return target?.logo
}

export { SupportedNetworks, isSupportedChain, getNetworkImg }