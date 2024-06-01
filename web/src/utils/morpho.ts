import { formatBalance } from './balance';
import { MORPHO as MorphoToken } from './tokens';

export const MORPHO = '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';

export const getRewardPer1000USD = (yearlySupplyTokens: string, marketSupplyAssetUSD: number) => {
  return (
    (formatBalance(yearlySupplyTokens, MorphoToken.decimals) / marketSupplyAssetUSD) *
    1000
  ).toString();
};

export const getUserRewardPerYear = (
  yearlySupplyTokens: string | null,
  marketSupplyAssetUSD: number,
  userSuppliedUSD: number,
) => {
  if (!yearlySupplyTokens) return '0';
  return (
    (formatBalance(yearlySupplyTokens, MorphoToken.decimals) * Number(userSuppliedUSD)) /
    marketSupplyAssetUSD
  ).toFixed(2);
};
