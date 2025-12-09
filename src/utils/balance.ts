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

/**
 * Same as formatUnit, but output number instead of bigint, not accurate
 * @param value
 * @param decimals
 * @returns
 */
export const formatBalance = (value: bigint | string, decimals: number) => {
  return Number(value) / 10 ** decimals;
};

export function formatReadable(_num: number | string, precision = 2): string {
  let num = _num;

  if (typeof num === 'string') {
    const parsed = Number.parseFloat(num);
    if (isNaN(parsed)) return num;
    num = parsed;
  }

  try {
    if (Math.abs(num) >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(precision);
  } catch (e) {
    console.log('Error formatting number', e, typeof num);
    return num.toString();
  }
}

export function formatSimple(num: number | bigint) {
  return new Intl.NumberFormat('en-us', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
