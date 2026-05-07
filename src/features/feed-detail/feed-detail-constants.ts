export const ORACLE_CONTRACTS_PAGE_SIZE = 8;
export const MARKETS_PAGE_SIZE = 10;

export const PRICE_HISTORY_POINT_COUNT = 24;
export const PRICE_HISTORY_WINDOW_SECONDS = 24 * 60 * 60;
export const PRICE_HISTORY_INTERVAL_SECONDS = PRICE_HISTORY_WINDOW_SECONDS / (PRICE_HISTORY_POINT_COUNT - 1);
export const PRICE_HISTORY_MIN_VISIBLE_RANGE_RATIO = 0.01;

export const FEED_TYPE_PAGE_COPY: Record<string, string> = {
  market: 'A market feed reports an observed asset-pair price, usually from exchange or aggregated market pricing.',
  fundamental: 'A fundamental feed reports a protocol conversion rate or accounting relationship, not a traded spot price.',
  nav: 'A NAV feed reports net asset value based on assets, liabilities, reserves, or collateralization.',
  dex: 'A DEX feed derives price from onchain market structure such as a pool, TWAP, or Pendle market.',
};
