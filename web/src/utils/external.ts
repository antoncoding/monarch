export const getMarketURL = (id: string): string => {
  return `https://app.morpho.org/market?id=${id}`;
};

export const getAssetURL = (address: string): string => {
  return `https://etherscan.io/token/${address}`;
};

export const getExplorerURL = (address: string): string => {
  return `https://etherscan.io/address/${address}`;
};
