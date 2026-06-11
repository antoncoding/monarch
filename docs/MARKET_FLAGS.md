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
  reasons: MarketDiscoveryFlagReason[];
  summary: string;
};
```

The frontend turns this into lookup maps for compact row badges, discovery prioritization, and row focus styling. Client-side oracle/asset warnings still stay in their existing warning path.

## Follow-Ups

- Remove the custom tag feature and make all market-list badges backend-defined.
- Add filters such as "protected", "warning", and "no risk".
- Define "no risk" as no backend warning flags plus no client-side asset/oracle/state warnings.
- Add more opinionated backend flags over time, such as new market and popular market.
