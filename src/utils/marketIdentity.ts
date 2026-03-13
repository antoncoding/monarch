export const getChainScopedMarketKey = (marketUniqueKey: string, chainId: number): string => {
  return `${marketUniqueKey.toLowerCase()}-${chainId}`;
};
