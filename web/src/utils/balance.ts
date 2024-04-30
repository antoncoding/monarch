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

export const toRawBalance = (value: number | string, decimals: number) => {
  return Number(value) * 10 ** decimals;
}

export function formatUSD(num: number): string {
  if (Math.abs(num) >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(2) + 'B';
  } else if (Math.abs(num) >= 1_000_000) {
      return (num / 1_000_000).toFixed(2) + 'M';
  } else if (Math.abs(num) >= 1_000) {
      return (num / 1_000).toFixed(2) + 'K';
  } else {
      return num.toFixed(2);
  }
}