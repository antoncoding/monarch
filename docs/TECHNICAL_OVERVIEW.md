# Monarch Technical Overview

## Executive Summary

Monarch is a client-side DeFi dashboard for the Morpho Blue lending protocol. It aggregates data from multiple chains (Ethereum, Base, Polygon, Arbitrum, Unichain, HyperEVM, Monad) and presents markets, vaults, and user positions in a unified interface. The app is **fully client-side** with no backend database—all user preferences persist in localStorage.

**Key Architectural Decisions:**
- Next.js 15 App Router with React 18
- Multi-source strategy: Morpho API + Monarch API + selective subgraph fallback
- Zustand for client state, React Query for server state
- All user data in localStorage (no backend DB)
- Multi-chain support with custom RPC override capability

---

## Tech Stack

### Blockchain Layer
| Technology | Version | Purpose |
|-----------|---------|---------|
| Wagmi | 3.1.0 | React hooks for Ethereum |
| Viem | 2.40.2 | Ethereum utilities |
| @reown/appkit | 1.8.14 | Wallet connection (WalletConnect v3) |
| @morpho-org/blue-sdk | 5.3.0 | Morpho Blue protocol SDK |
| Velora (ParaSwap) API | HTTP | Same-chain quote + transaction payloads for swaps |

**Wagmi v3 integration notes:**
- Prefer `useConnection()` when you need wallet state (`address`, `chainId`, `isConnected`) in one place.
- Avoid introducing `useAccount()` + `useChainId()` pairs for new wallet-state sync logic.
- `useTransactionWithToast` already reports `useSendTransaction` failures to Sentry; global React Query mutation telemetry should not re-capture `sendTransaction` mutation errors.

### State Management
| Technology | Version | Purpose |
|-----------|---------|---------|
| Zustand | 5.0.9 | Client state (11 persisted stores) |
| TanStack React Query | 5.69.0 | Server state, caching |

### UI Layer
| Technology | Purpose |
|-----------|---------|
| Tailwind CSS 4.1 | Styling |
| Radix UI | Headless components |
| Framer Motion | Animations |
| Recharts | Charts |
| react-table | Tables |

---

### Provider Hierarchy
```
RootLayout
├── ThemeProviders (dark/light mode)
├── QueryProvider (React Query)
├── OnchainProviders
│   └── CustomRpcProvider → WagmiConfigProvider
├── VaultRegistryProvider (global vault lookup)
├── ClientProviders
│   ├── GlobalModalProvider
│   └── OnboardingProvider
├── DataPrefetcher
└── ModalRenderer
```

---

## Core Domain Objects

### Market
```typescript
{
  id: string;
  uniqueKey: string;              // Composite identifier
  lltv: string;                   // Liquidation LTV
  irmAddress: string;             // Interest Rate Model
  oracleAddress: string;
  loanAsset: TokenInfo;           // Borrow token
  collateralAsset: TokenInfo;     // Collateral token
  state: {
    supplyAssets, supplyUsd, supplyApy;
    borrowAssets, borrowUsd, borrowApy;
    liquidityAssets, liquidityUsd;
    utilization;
  };
}
```

### Position
```typescript
MarketPosition {
  market: Market;
  state: {
    supplyShares, supplyAssets;
    borrowShares, borrowAssets;
    collateral;
  };
}

GroupedPosition {  // Grouped by loan asset
  loanAsset, totalSupply, totalWeightedApy;
  markets: MarketPositionWithEarnings[];
  collaterals: { address, symbol, amount }[];
}
```

### Vault (Morpho V2)
```typescript
{
  address: string;
  chainId: number;
  name: string;
  totalAssets: string;
  assetAddress: string;
  curator: string;
  allocations: VaultAllocation[];
}
```

### Oracle
```typescript
StandardOracleOutput {
  address: string;
  chainId: number;
  type: 'standard';
  data: OracleOutputData; // { baseFeedOne, baseFeedTwo, quoteFeedOne, quoteFeedTwo, baseVault, quoteVault }
}

MetaOracleOutput {
  address: string;
  chainId: number;
  type: 'meta';
  data: MetaOracleOutputData; // { primaryOracle, backupOracle, currentOracle, oracleSources, ... }
}

NonStandardOracleOutput {
  address: string;
  chainId: number;
  type: 'custom' | 'unknown';
  data: { reason: string };
}
```

---

## Transaction Architecture

### Bundler Responsibility Matrix

| Path | Bundler | Notes |
|------|---------|-------|
| Multi-supply / direct supply / borrow / repay / rebalance | Bundler V2 | Current production path |
| Leverage/deleverage (current deterministic ERC4626 route) | Bundler V2 | Existing route remains unchanged |
| Generic swap-only modal | No bundler (Velora direct tx) | Quote + tx payload from Velora API |
| Planned: `rebalanceWithSwap`, generalized `useLeverage` (any pair) | Bundler V3 | Planned migration path for swap-dependent actions |

### Authorization Model

- Any flow that sends Morpho actions through Bundler V2 must pass through `useBundlerAuthorizationStep`.
- Signature mode is used for Permit2 and native-token flows.
- Transaction mode is used for standard ERC20 approval flow when signature mode is not selected.
- See [`BUNDLER_STRATEGY.md`](/Users/antonasso/programming/morpho/monarch/docs/BUNDLER_STRATEGY.md) for migration rules and security guardrails.

---

## Data Sources

### Multi-Source Strategy

```
Markets / positions: Morpho API (https://blue-api.morpho.org/graphql)
                    ↓ (if unavailable or unsupported chain)
                    Subgraph (The Graph / Goldsky)

Autovault metadata: Monarch GraphQL (https://api.monarchlend.xyz/graphql)
                   ↓ (if indexer lag / API failure)
                   Narrow on-chain RPC fallback

Market detail participants/activity + admin stats transactions:
                    Monarch GraphQL (https://api.monarchlend.xyz/graphql)
                    ↓ (for market-detail fallback only)
                    Morpho API / Subgraph

Market metrics: Monarch metrics API via `/api/monarch/metrics`
```

**Morpho API Supported Chains:** Mainnet, Base, Unichain, Polygon, Arbitrum, HyperEVM, Monad

### Static Data (Build-time or cached)
| Data Type | Source | Location |
|-----------|--------|----------|
| Network configs | Hardcoded | `/src/utils/networks.ts` |
| Default blacklist | Hardcoded | `/src/constants/markets/blacklisted.ts` |

### Dynamic Data (Runtime fetched)
| Data Type | Source | Refresh | Query Hook |
|-----------|--------|---------|------------|
| Markets list | Morpho API/Subgraph | 5 min stale | `useMarketsQuery` |
| Market metrics (flows, trending) | Monarch API | 5 min stale | `useMarketMetricsQuery` |
| Market state (APY, utilization) | RPC snapshot + Morpho API/Subgraph | 30s stale | `useMarketData` |
| User positions | Monarch position discovery + on-chain snapshots + market registry from `useProcessedMarkets` | 5 min | `useUserPositions` |
| User transaction history | Monarch GraphQL → Morpho API → Subgraph (`assetIds` queries still skip Monarch) | 60s | `useUserTransactionsQuery` |
| Vaults list | Morpho API | 5 min | `useAllMorphoVaultsQuery` |
| User autovault metadata | Monarch GraphQL + on-chain enrichment | 60s | `useUserVaultsV2Query` |
| Vault detail/settings metadata | Monarch GraphQL + narrow RPC fallback | 30s | `useVaultV2Data` |
| Market detail participants/activity | Monarch GraphQL + Morpho API/Subgraph fallback | 2-5 min stale | `useMarketSuppliers` / `useMarketBorrowers` / `useMarketSupplies` / `useMarketBorrows` |
| Vault allocations | On-chain multicall | 30s | `useAllocationsQuery` |
| Token balances | On-chain multicall | 5 min | `useUserBalancesQuery` |
| Oracle metadata | Scanner Gist | 30 min | `useOracleMetadata` / `useAllOracleMetadata` |
| User rewards and distributions | Morpho rewards REST + Merkl API | 30s | `useUserRewardsQuery` |
| Reward campaigns | Merkl API | 5 min stale | `useMerklCampaignsQuery` |
| Market liquidations | Monarch GraphQL + Morpho API/Subgraph fallback | 5 min stale | `useMarketLiquidations` |
| Admin stats transactions | Monarch GraphQL + market registry/token price enrichment | 2 min stale | `useMonarchTransactions` |

### Data Hook Responsibility Matrix

This is the migration checklist for the Monarch API (Envio GraphQL endpoint). "Full Monarch support" here means the feature would still work if Morpho API and subgraph reads were unavailable.

Hooks omitted from this matrix are local-state hooks or pure view/composition helpers that do not own remote transport reads.

#### Core Markets And Positions

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useMarketsQuery` | Global market registry used across the app | Morpho API first per chain, then subgraph | Monarch market registry and market detail parity |
| `useProcessedMarkets` | Blacklist/filtering layer on top of market registry, plus USD backfill | `useMarketsQuery` + `useTokenPrices` | Inherits `useMarketsQuery`; also needs a Monarch-native token price source if we want to remove Morpho price reads |
| `useMarketData` | Single-market detail shell with freshest live state | RPC snapshot + Morpho API, then subgraph | Monarch single-market metadata/detail path |
| `useMarketHistoricalData` | Historical market chart series | Morpho historical API, then subgraph | Monarch historical market snapshots/timeseries |
| `useTokenPrices` | Token USD price lookup and peg fallback used by markets/admin stats | Morpho price API + major price fallback | Monarch price endpoint or another canonical replacement |
| `useUserPositions` | Discover all markets where a user has positions, then attach live balances | Monarch batched `Position` discovery + RPC snapshots/oracle reads + market metadata from `useProcessedMarkets`; Morpho/Subgraph fallback for discovery | Monarch market registry/detail if position objects should no longer depend on Morpho/Subgraph market metadata |
| `useUserPosition` | Single-market user position | RPC snapshot first; if snapshot unavailable, Monarch position state when local market exists; then Morpho/Subgraph fallback | Same market-registry/detail gap as `useUserPositions` |
| `useUserTransactionsQuery` / `fetchUserTransactions` | User history across one or many chains | Monarch user-event tables first; fallback Morpho API, then subgraph; `assetIds` filter still bypasses Monarch | Asset-address filtered history support to fully back reports and any asset-scoped history views |
| `useUserPositionsSummaryData` | Portfolio earnings summary for active positions | `useUserPositions` + `useUserTransactionsQuery` + RPC block/snapshot helpers | Inherits the remaining `useUserPositions` and `useUserTransactionsQuery` gaps |
| `usePositionReport` | Asset-scoped earnings/report generation | `fetchUserTransactions(assetIds=...)` + RPC block/snapshot helpers | Still blocked on Monarch support for `assetIds`-scoped user history |
| `usePositionHistoryChart` | Derive chart points for one asset/market group | Pure derivation from transactions + snapshots already fetched elsewhere | No backend gap; inherits upstream history/snapshot gaps |

#### Market Detail And Admin Reads

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useMarketSuppliers` / `useMarketBorrowers` | Paginated open positions on one market | Monarch first, then Morpho API, then subgraph | Already Monarch-first; no new Envio schema gap identified |
| `useAllMarketSuppliers` / `useAllMarketBorrowers` | Non-paginated top positions for concentration charts | Monarch first, then Morpho API, then subgraph | Already Monarch-first; no new Envio schema gap identified |
| `useMarketSupplies` / `useMarketBorrows` | Paginated supply/withdraw and borrow/repay activity | Monarch first, then Morpho API, then subgraph | Already Monarch-first; no new Envio schema gap identified |
| `useMarketLiquidations` | Paginated liquidations | Monarch first, then Morpho API, then subgraph | Already Monarch-first; no new Envio schema gap identified |
| `useMonarchTransactions` | Admin stats feed and aggregated flow dashboards | Monarch transactions + `useProcessedMarkets` + `useTokenPrices` | If admin stats should be fully independent, Monarch also needs market registry/metadata and a non-Morpho price source |

#### Vaults And Allocators

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useUserVaultsV2Query` | User vault list with optional balance, TVL, and yield enrichment | Monarch vault metadata + RPC balances/totalAssets + RPC 4626 yield snapshots | Already off Morpho for yield; no new Envio schema gap identified |
| `useVaultV2Data` | Vault detail/settings metadata for a single vault | Monarch vault detail first, narrow RPC fallback if metadata unavailable | Already aligned with Monarch-first design |
| `useAllMorphoVaultsQuery` | Global whitelisted vault registry | Morpho API only | Monarch/public vault registry parity |
| `usePublicAllocatorVaults` | Public allocator config for supplying vaults in a market | Morpho API only | Monarch/public allocator config endpoint parity |
| `useAllocationsQuery` | Live vault `allocation(capId)` values | Pure RPC multicall | No Envio gap |
| `usePublicAllocatorLiveData` | Live flow caps, vault supply, and liquidity for allocator UX | Pure RPC multicall | No Envio gap |
| `useVaultHistoricalApy` / `use4626VaultAPR` | Historical 4626 yield and expected carry calculations | Pure RPC share-price snapshots + RPC Morpho market reads | No Envio gap |

#### RPC Helpers And External Reads

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useCurrentBlocks` / `useBlockTimestamps` / `usePositionSnapshots` / `useFreshMarketsState` / `useHistoricalSupplierPositions` | Block, snapshot, and live-state helpers used by positions/charts | Pure RPC reads via viem/wagmi | No Envio gap |
| `useUserBalancesQuery` | ERC20 wallet balances across chains | Pure RPC multicall via wagmi | No Envio gap |
| `useTokensQuery` | Token metadata lookup for app UI | Local token registry + Pendle assets API | Not part of Monarch migration |
| `useOracleMetadata` / `useAllOracleMetadata` | Oracle classification and feed metadata | Scanner gist JSON | Not part of Monarch migration |
| `useMarketMetricsQuery` | Enhanced market metrics, flows, trending, scores | Monarch metrics API via `/api/monarch/metrics` | Already Monarch-backed |
| `useUserRewardsQuery` | Claimable rewards and distributions | Morpho rewards REST + Merkl API | Outside Monarch/Envio scope today |
| `useMerklCampaignsQuery` / `useMerklHoldIncentivesQuery` | Campaign and HOLD incentive enrichment | Merkl API + hardcoded opportunity mapping | Outside Monarch/Envio scope today |

### Data Flow Patterns

**Market Data Flow:**
```
Raw API fetch → Blacklist filtering →
Split: allMarkets vs whitelistedMarkets
```

**Position Data Flow:**
```
1. Discover market keys via Monarch batched `Position` reads when possible; fall back to Morpho API/Subgraph
2. Fetch on-chain snapshots per market (`usePositionSnapshots`)
3. Combine live balances with market metadata from `useProcessedMarkets`
4. Group by loan asset
5. Calculate earnings
```

**Vault Data Flow:**
```
1. Fetch chain-scoped vault metadata from Monarch GraphQL
2. Enrich user-specific balances / totalAssets via multicall where needed
3. Use narrow RPC fallback only when Monarch vault metadata is unavailable
4. Fetch live allocations from on-chain `allocation(capId)` reads
5. After vault writes, use shared bounded retry refreshes so Monarch indexing can catch up
```

---

## State Management

### Server State (React Query)
```typescript
// Query client config
staleTime: 30 seconds
refetchOnWindowFocus: false
retry: 2 attempts (exponential backoff)
GraphQL errors: No retry
```

### Client State (Zustand Stores)

**Persisted to localStorage (11 stores):**
| Store | Key | Purpose |
|-------|-----|---------|
| `useAppSettings` | `monarch_store_appSettings` | Permit2, ETH, APR display |
| `useMarketPreferences` | `monarch_store_marketPreferences` | Sort, filters, columns |
| `useTrustedVaults` | `monarch_store_trustedVaults` | User's vault whitelist |
| `useBlacklistedMarkets` | `monarch_store_blacklistedMarkets` | Custom blacklist |
| `useCustomRpc` | `monarch_store_customRpc` | Per-chain RPC URLs |
| `useUserMarketsCache` | `monarch_store_userMarketsCache` | Position cache |
| `useNotificationStore` | `monarch_store_notifications` | Dismissed notifications |
| `useTransactionFilters` | `monarch_store_transactionFilters` | Per-symbol filters |
| `usePositionsPreferences` | `monarch_store_positionsPreferences` | Position display |
| `usePositionsFilters` | `monarch_store_positionsFilters` | Earnings period |
| `useHistoryPreferences` | `monarch_store_historyPreferences` | History display |

**In-memory only:**
- `useModalStore` - Modal stack
- `useMarketsFilters` - Temporary filters
- `useMarketDetailChartState` - Chart state

---

## Data Fetching Internals

### Query Hooks

All hooks in `/src/hooks/queries/` follow React Query patterns:

| Hook | Key | Stale Time | Refetch | Focus |
|------|-----|------------|---------|-------|
| `useMarketsQuery` | `['markets']` | 5 min | 5 min | Yes |
| `useMarketMetricsQuery` | `['market-metrics', ...]` | 5 min | 5 min | No |
| `useTokensQuery` | `['tokens']` | 5 min | 5 min | Yes |
| `useUserBalancesQuery` | `['user-balances', addr, networks]` | 30s | - | Yes |
| `useUserVaultsV2Query` | `['user-vaults-v2', addr]` | 60s | - | Yes |
| `useVaultV2Data` | `['vault-v2-data', addr, chainId]` | 30s | - | No |
| `useMarketLiquidations` | `['marketLiquidations', id, net]` | 5 min | - | Yes |
| `useUserTransactionsQuery` | `['user-transactions', ...]` | 60s | - | No |
| `useAllocationsQuery` | `['vault-allocations', ...]` | 30s | - | No |

### Data Source Switching

**File:** `/src/config/dataSources.ts`

```
supportsMorphoApi(network) returns true for:
- Mainnet, Base, Unichain, Polygon, Arbitrum, HyperEVM, Monad

Fallback Strategy:
1. IF supportsMorphoApi(network) → Try Morpho API
2. IF API fails OR unsupported → Try Subgraph
3. Each network fails independently (partial data OK)
```

### GraphQL Fetchers

**Morpho API** (`/src/data-sources/morpho-api/fetchers.ts`):
- Endpoint: `https://blue-api.morpho.org/graphql`
- `cache: 'no-store'` (disable browser cache)
- Throws on GraphQL errors (strict)

**Monarch GraphQL** (`/src/data-sources/monarch-api/fetchers.ts`):
- Endpoint: `NEXT_PUBLIC_MONARCH_API_NEW`
- Browser fetch with `NEXT_PUBLIC_MONARCH_API_KEY`
- Used as the primary read path for autovault V2 metadata, market-detail reads, and admin transaction reads

**Subgraph** (`/src/data-sources/subgraph/fetchers.ts`):
- Configurable URL per network
- Logs GraphQL errors but continues (lenient)
- Adds price estimation for unknown tokens

### Complete Data Flow: Market Data

```
1. useMarketData(uniqueKey, network) called
   ↓
2. Parallel queries start:
   - usePublicClient() for on-chain reads
   - useOracleMetadata() for oracle classification and feed details
   ↓
3. Market fetch:
   a. Try on-chain snapshot (viem multicall)
   b. Try Morpho API (if supported)
   c. Fallback to Subgraph
   d. Merge snapshot with API state
   ↓
4. Oracle metadata resolves separately by `chainId + oracleAddress`
   - Standard/meta oracle UI reads scanner-native `OracleOutputData` / `MetaOracleOutputData`
   - No Morpho API oracle feed enrichment or local feed-shape conversion
   ↓
5. Return { data: enrichedMarket, isLoading, error }
```

### Key Patterns

1. **Fallback Chain**: API → Subgraph → Empty
2. **Parallel Execution**: `Promise.all()` for multi-network
3. **Graceful Degradation**: Partial data > Error
4. **Two-Phase Market**: On-chain snapshot + API state
5. **Hybrid Reads**: Scanner metadata for oracle structure + live RPC/API for market state

---

## External Integrations

### APIs
| Service | Endpoint | Purpose |
|---------|----------|---------|
| Morpho API | `https://blue-api.morpho.org/graphql` | Markets, vaults, positions |
| Monarch GraphQL | `https://api.monarchlend.xyz/graphql` | Autovault metadata, market detail/activity, admin transactions |
| Monarch Metrics | `/api/monarch/metrics` → external Monarch metrics API | Market metrics and admin stats |
| The Graph | Per-chain subgraph URLs | Fallback data, suppliers, borrowers |
| Merkl API | `https://api.merkl.xyz` | Reward campaigns |
| Velora API | `https://api.paraswap.io` | Swap quotes and executable tx payloads |
| Alchemy | Per-chain RPC | Default RPC provider |

### Smart Contracts
- Morpho Blue core contracts
- Vault V2 contracts
- IRM (Interest Rate Model) contracts
- Oracle contracts (Chainlink, Redstone)

### Supported Networks
| Network | Chain ID | Block Time |
|---------|----------|------------|
| Ethereum Mainnet | 1 | 12s |
| Base | 8453 | 2s |
| Polygon | 137 | 2s |
| Arbitrum | 42161 | 0.25s |
| Unichain | 130 | 1s |
| HyperEVM | 999 | 1s |
| Monad | 143 | 0.4s |

---

## Critical Files Reference

| Purpose | Location |
|---------|----------|
| Type Definitions | `/src/utils/types.ts` |
| Network Configs | `/src/utils/networks.ts` |
| Data Source Config | `/src/config/dataSources.ts` |
| GraphQL Queries | `/src/graphql/morpho-api-queries.ts` |
| All Stores | `/src/stores/` |
| All Query Hooks | `/src/hooks/queries/` |
| Vault Storage | `/src/utils/vault-storage.ts` |
| Bundler Migration Notes | `/docs/BUNDLER_STRATEGY.md` |
