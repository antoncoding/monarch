export const toChainAssetKey = (address: string, chainId: number): string => {
  return `${address.toLowerCase()}-${chainId}`;
};
