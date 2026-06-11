# Market Flags Direction

Market-list flags should be backend-defined by default. The frontend should not need to fetch every market's full metrics payload just to decide which compact badges or filters to show.

## Current Split

- Backend flags: liquidation/protection marker, official growing/popular marker, and market-price bad-debt warning.
- Frontend warnings: oracle/feed warnings, asset recognition warnings, and simple state warnings that are already available on the market object.
- Legacy metrics: `/v1/markets/metrics` still carries flows and custom-tag inputs, but custom tags are not a core market-list feature.

## Current Shape

Keep `/v1/markets/metrics` for compatibility. The smaller `/v1/markets/flags` response powers list-screen discovery controls and returns market IDs grouped by backend-defined category:

```ts
type MarketFlagsResponse = {
  updatedAt: string | null;
  flags: {
    newOpportunities: MarketDiscoveryFlag[];
    trending: MarketDiscoveryFlag[];
    popular: MarketDiscoveryFlag[];
  };
};

type MarketDiscoveryFlag = {
  chainId: number;
  marketUniqueKey: string;
  marketCreatedAt: string | null;
  marketCreationBlockNumber: number | null;
  reasons: MarketDiscoveryFlagReason[];
  summary: string;
};
```

The API returns each discovery category ordered from most exciting to least exciting. The frontend always shows backend discovery indicators for flagged markets. Discovery control selections only prioritize matching rows and add temporary row focus; they do not turn tags on or off.

`newOpportunities` is intentionally stricter than broad volume: a market needs Morpho listing, a collateral asset, healthy utilization, at least `$500k` supply/TVL, a vault signal, and recent first liquidity. A market qualifies if it was created in the last `10d` with at least `$500k` 7d supply flow, or if it had less than `$500k` prior supply before at least `$500k` 7d supply flow arrived.

`trending` is the legacy API key for the user-facing Growing category. It is significant relative supply/borrow growth above recent baseline, not a proxy for every large dollar-flow market. The backend requires collateralized, listed, healthy markets, then either `24h` flow of at least `$500k`, `20%`, and 3x the prior 6d daily baseline, or `7d` flow of at least `$1M`, `25%`, and 1.5x the prior 23d weekly baseline. Quiet prior baselines are allowed, which covers genuine first-wave liquidity without calling old, huge books new.

The frontend also uses `marketCreatedAt` from `/v1/markets/metrics` to show creation timing in the expanded market row. The UI shows the date and age only, not the creation block. Client-side oracle/asset warnings still stay in their existing warning path.

## Follow-Ups

- Remove the custom tag feature and make all market-list badges backend-defined.
- Add filters such as "protected", "warning", and "no risk".
- Define "no risk" as no backend warning flags plus no client-side asset/oracle/state warnings.
- Add more opinionated backend flags over time, such as new market and popular market.
