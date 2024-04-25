export type WagmiFetchBalanceResult = {
  decimals: number;
  formatted: string;
  symbol: string;
  value: bigint;
};

/**
 * TODO Docs
 */
export const getAccountBalance = (data?: WagmiFetchBalanceResult) => {
  return `${data?.formatted.slice(0, 5)} ${data?.symbol}`;
};

export const formatBalance = (value: bigint | string, decimals: number) => {
  return Number(value) / (10 ** decimals);
}

export const toRawBalance = (value: number, decimals: number) => {
  return BigInt(value * 10 ** decimals);
}