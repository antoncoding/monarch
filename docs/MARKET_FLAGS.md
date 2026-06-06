# Market Flags Direction

Market-list flags should be backend-defined by default. The frontend should not need to fetch every market's full metrics payload just to decide which compact badges or filters to show.

## Current Split

- Backend flags: liquidation/protection marker, official trending/popular marker, and market-price bad-debt warning.
- Frontend warnings: oracle/feed warnings, asset recognition warnings, and simple state warnings that are already available on the market object.
- Legacy metrics: `/v1/markets/metrics` still carries flows and custom-tag inputs, but custom tags are not a core market-list feature.

## Target Shape

Keep `/v1/markets/metrics` for compatibility, then add a smaller market-flags response for list screens. It should return market IDs grouped by flag, with `chainId` included for every ID:

```ts
type MarketFlagsResponse = {
  protected: MarketFlagId[];
  trending: MarketFlagId[];
  newMarkets: MarketFlagId[];
  warnings: Array<MarketFlagId & {
    code: string;
    severity: 'warning' | 'alert';
    summary: string;
  }>;
};

type MarketFlagId = {
  chainId: number;
  marketUniqueKey: string;
};
```

The frontend can turn this into a lookup map and merge it with client-side oracle/asset warnings for the existing risk indicators and filters.

## Follow-Ups

- Remove the custom tag feature and make all market-list badges backend-defined.
- Add filters such as "protected", "trending", "warning", and "no risk".
- Define "no risk" as no backend warning flags plus no client-side asset/oracle/state warnings.
- Add more opinionated backend flags over time, such as new market and popular market.
