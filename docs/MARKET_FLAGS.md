# Market Flags Direction

Market-list flags should be backend-defined by default. The frontend should not need to fetch every market's full metrics payload just to decide which compact badges or filters to show.

## Current Split

- Backend flags: liquidation/protection marker, official trending/popular marker, and market-price bad-debt warning.
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

`newOpportunities` is intentionally stricter than broad volume: a market needs Morpho listing, healthy utilization, at least `$500k` supply/TVL, a vault signal, and fresh large supply activation. Older markets qualify only from large `24h` supply or vault supply flow; a market created in the last `3d` can qualify from `7d` supply flow because the full flow window is inside the market lifetime.

The frontend also uses `marketCreatedAt` from `/v1/markets/metrics` to show creation timing in the expanded market row. Client-side oracle/asset warnings still stay in their existing warning path.

## Follow-Ups

- Remove the custom tag feature and make all market-list badges backend-defined.
- Add filters such as "protected", "warning", and "no risk".
- Define "no risk" as no backend warning flags plus no client-side asset/oracle/state warnings.
- Add more opinionated backend flags over time, such as new market and popular market.
