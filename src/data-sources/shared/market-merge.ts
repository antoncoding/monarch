import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import type { Market } from '@/utils/types';

export const mergeMarketState = (baseMarket: Market, overlayMarket: Market): Market => {
  return {
    ...baseMarket,
    lltv: overlayMarket.lltv || baseMarket.lltv,
    irmAddress: overlayMarket.irmAddress || baseMarket.irmAddress,
    oracleAddress: overlayMarket.oracleAddress || baseMarket.oracleAddress,
    state: {
      ...baseMarket.state,
      borrowAssets: overlayMarket.state.borrowAssets,
      supplyAssets: overlayMarket.state.supplyAssets,
      borrowShares: overlayMarket.state.borrowShares,
      supplyShares: overlayMarket.state.supplyShares,
      liquidityAssets: overlayMarket.state.liquidityAssets,
      utilization: overlayMarket.state.utilization,
      supplyApy: overlayMarket.state.supplyApy,
      borrowApy: overlayMarket.state.borrowApy,
      fee: overlayMarket.state.fee,
      timestamp: overlayMarket.state.timestamp,
      apyAtTarget: overlayMarket.state.apyAtTarget,
      rateAtTarget: overlayMarket.state.rateAtTarget,
      dailySupplyApy: overlayMarket.state.dailySupplyApy ?? baseMarket.state.dailySupplyApy,
      dailyBorrowApy: overlayMarket.state.dailyBorrowApy ?? baseMarket.state.dailyBorrowApy,
      weeklySupplyApy: overlayMarket.state.weeklySupplyApy ?? baseMarket.state.weeklySupplyApy,
      weeklyBorrowApy: overlayMarket.state.weeklyBorrowApy ?? baseMarket.state.weeklyBorrowApy,
      monthlySupplyApy: overlayMarket.state.monthlySupplyApy ?? baseMarket.state.monthlySupplyApy,
      monthlyBorrowApy: overlayMarket.state.monthlyBorrowApy ?? baseMarket.state.monthlyBorrowApy,
    },
  };
};

export const mergeMarketsByIdentity = (markets: Market[]): Market[] => {
  const merged = new Map<string, Market>();

  for (const market of markets) {
    const key = getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, market);
      continue;
    }

    merged.set(key, mergeMarketState(existing, market));
  }

  return Array.from(merged.values());
};
