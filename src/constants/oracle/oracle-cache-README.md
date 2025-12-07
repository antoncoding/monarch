# Oracle Cache

## Purpose

Centralized cache of oracle metadata from Morpho's official API. This cache provides oracle feed data (baseFeedOne, baseFeedTwo, quoteFeedOne, quoteFeedTwo) for all markets across all supported networks.

## Why Separate Oracle Data?

Oracle contracts are **immutable** once a market is created. By separating oracle data from market data:

1. **Performance**: ~100-200 unique oracles vs 1000+ markets = 90% reduction in redundant data
2. **Reliability**: Oracle metadata remains available even when Morpho API is down
3. **Separation of Concerns**: Markets (mutable state) vs Oracles (immutable metadata)
4. **DRY Principle**: Single source of truth for oracle data

## Architecture

```
OracleDataContext (loads once on app start)
  ↓
  1. Fetch from Morpho API (all networks in parallel)
  2. Fallback to oracle-cache.json if API fails
  3. Merge with oracle-whitelist.ts overrides
  ↓
MarketsContext / useMarketData
  ↓
  Enrich markets with oracle data via getOracleData(address, chainId)
  ↓
Components receive Market[] with oracle.data populated
```

## Usage

### Generating Cache

To update oracle cache from Morpho API:

```bash
pnpm generate:oracle
```

This fetches fresh oracle metadata from all supported networks and generates `oracle-cache.json`.

### In Code

The oracle enrichment happens automatically in:
- `MarketsContext` → enriches all markets from `useMarkets()`
- `useMarketData` → enriches individual market queries

Components using `const { markets } = useMarkets()` receive fully enriched markets with `oracle.data` - no code changes needed!

## Supported Networks

- Mainnet (1)
- Base (8453)
- Polygon (137)
- Unichain (130)
- Arbitrum (42161)
- HyperEVM (999)
- Monad (143)

## Data Structure

```typescript
type CachedOracleEntry = {
  address: string;        // Oracle contract address (lowercase)
  chainId: number;        // Network ID
  data: {                 // Oracle feed metadata
    baseFeedOne: OracleFeed | null;
    baseFeedTwo: OracleFeed | null;
    quoteFeedOne: OracleFeed | null;
    quoteFeedTwo: OracleFeed | null;
  };
};
```

## Priority Order

When looking up oracle data:

1. **Highest Priority**: Oracle whitelist (`src/config/oracle-whitelist.ts`)
2. **Medium Priority**: Morpho API (fetched on app start)
3. **Lowest Priority**: oracle-cache.json (fallback)

## Maintenance

Run `pnpm generate:oracle` periodically to keep cache updated with new oracles as markets are created.
