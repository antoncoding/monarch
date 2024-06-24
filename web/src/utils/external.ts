export const getMarketURL = (id: string, chainId: number): string => {
  const chain = chainId === 1 ? 'mainnet' : 'base';
  return `https://app.morpho.org/market?id=${id}&network=${chain}`;
};

export const getAssetURL = (address: string): string => {
  return `https://etherscan.io/token/${address}`;
};

export const getExplorerURL = (address: string): string => {
  return `https://etherscan.io/address/${address}`;
};
