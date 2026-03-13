import { blacklistTokens } from '@/utils/tokens';
import type { Market } from '@/utils/types';

type MarketAddressShape = {
  collateralToken?: string | null;
  loanToken?: string | null;
};

const normalizeAddress = (address: string | null | undefined): string => {
  return address?.toLowerCase() ?? '';
};

export const isBlacklistedTokenAddress = (address: string | null | undefined): boolean => {
  const normalizedAddress = normalizeAddress(address);
  return normalizedAddress.length > 0 && blacklistTokens.includes(normalizedAddress);
};

export const isTokenBlacklistedMarket = (
  market: Pick<Market, 'collateralAsset' | 'loanAsset'> | MarketAddressShape,
): boolean => {
  const collateralAddress = 'collateralAsset' in market ? market.collateralAsset?.address : market.collateralToken;
  const loanAddress = 'loanAsset' in market ? market.loanAsset?.address : market.loanToken;

  return isBlacklistedTokenAddress(collateralAddress) || isBlacklistedTokenAddress(loanAddress);
};

export const filterTokenBlacklistedMarkets = <T extends Pick<Market, 'collateralAsset' | 'loanAsset'>>(markets: T[]): T[] => {
  return markets.filter((market) => !isTokenBlacklistedMarket(market));
};
