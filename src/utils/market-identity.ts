export const getMarketIdentityKey = (chainId: number, uniqueKey: string): string => {
  return `${chainId}-${uniqueKey.toLowerCase()}`;
};
