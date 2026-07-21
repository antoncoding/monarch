# Monarch Technical Overview

## Executive Summary

Monarch is a DeFi dashboard for the Morpho Blue lending protocol. It aggregates data from multiple chains (Ethereum, Optimism, Base, Polygon, Arbitrum, Unichain, HyperEVM, Monad, Katana) and presents markets, vaults, and user positions in a unified interface. The app has **no app-owned backend database** and persists user preferences in localStorage, while shared Next.js server routes can cache selected expensive reads or call protected infrastructure endpoints such as API-key creation.

**Key Architectural Decisions:**
- Next.js 15 App Router with React 18
- Multi-source strategy: Monarch API + Morpho API fallback + on-chain RPC snapshots
- Zustand for client state, React Query for server state
- All user data in localStorage (no backend DB)
- Multi-chain support with custom RPC override capability
- Historical rolling market rates assume archive-capable RPCs on every supported chain

---

## Tech Stack

### Blockchain Layer
| Technology | Version | Purpose |
|-----------|---------|---------|
| Wagmi | 3.1.0 | React hooks for Ethereum |
| Viem | 2.40.2 | Ethereum utilities |
| RainbowKit + Wagmi connectors | 2.2.11 / 3.1.0 | Wallet catalog, connection modal, injected wallets, Safe, and WalletConnect |
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
│   └── CustomRpcProvider → WagmiConfigProvider → RainbowKitProvider
├── VaultRegistryProvider (global vault lookup)
├── ClientProviders
│   ├── GlobalModalProvider
│   └── OnboardingProvider
├── DataPrefetcher
└── ModalRenderer
```

`DataPrefetcher` warms token and market-whitelist metadata for product routes. The standalone analysis route skips this global prefetch because it manages its own data dependencies.

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
Market registry / market shells:
                    Monarch GraphQL (https://indexer.monarchlend.xyz/graphql)
                    ↓ (for missing supported chains)
                    Morpho API (https://blue-api.morpho.org/graphql)

Market detail live state + historical charts:
                    Monarch GraphQL (https://indexer.monarchlend.xyz/graphql)
                    ↓ (for shell metadata fallback and optional USD backfill)
                    Morpho API
                    ↓ (fresh balances / shares / liquidity override)
                    On-chain RPC snapshot

Autovault metadata: Monarch GraphQL (https://indexer.monarchlend.xyz/graphql)
                   ↓ (if indexer lag / API failure)
                   Narrow on-chain RPC fallback

Market detail participants/activity + admin stats transactions:
                    Monarch GraphQL (https://indexer.monarchlend.xyz/graphql)
                    ↓ (for market-detail fallback only)
                    Morpho API

Market metrics: external data API via `/v1/markets/metrics`
```

**App-supported Morpho API Chains:** Mainnet, Optimism, Base, Unichain, Polygon, Arbitrum, HyperEVM, Monad, Katana

### Static Data (Build-time or cached)
| Data Type | Source | Location |
|-----------|--------|----------|
| Network configs | Hardcoded | `/src/utils/networks.ts` |
| Default blacklist | Hardcoded | `/src/constants/markets/blacklisted.ts` |

### Dynamic Data (Runtime fetched)
| Data Type | Source | Refresh | Query Hook |
|-----------|--------|---------|------------|
| Markets list | Monarch multi-chain → Morpho per supported missing chain | 5 min stale | `useMarketsQuery` |
| Rolling market `24h/7d/30d` rates | Morpho API rolling fields → archive RPC snapshots + Morpho SDK math fallback | 15 min stale | `useMarketRateEnrichmentQuery` |
| Market metrics and flags | Monarch API | 15 min stale | `useMarketMetricsQuery` and `useMarketDiscoveryFlagsQuery`; see `docs/MARKET_FLAGS.md` for the compact flags shape |
| Market state (APY, utilization, balances) | Monarch market state + Morpho shell + RPC snapshot | 30s stale | `useMarketData` |
| Market historical chart series | Monarch GraphQL → Morpho API | 5 min stale | `useMarketHistoricalData` |
| User positions | Monarch position discovery/lifetime supply aggregates + on-chain snapshots + market registry from `useProcessedMarkets` | 5 min | `useUserPositions` |
| User transaction history | Monarch GraphQL → Morpho API (`assetIds` queries still skip Monarch) | 60s | `useUserTransactionsQuery` |
| Vaults list | Morpho API | 5 min | `useAllMorphoVaultsQuery` |
| User autovault metadata | Monarch GraphQL + on-chain enrichment | 60s | `useUserVaultsV2Query` |
| Vault detail/settings metadata | Monarch GraphQL + narrow RPC fallback | 30s | `useVaultV2Data` |
| Vault detail native-yield/deposits/share-price history | Morpho Vault V2 historical state → archive RPC fallback for deposits and share price | 5 min stale | `useVaultHistoryQuery` |
| Vault V2 rewards | Merkl API opportunities via `/api/merkl` | 5 min | `useVaultV2RewardsQuery` |
| Market detail participants/activity | Monarch GraphQL + Morpho API fallback | 2-5 min stale | `useMarketSuppliers` / `useMarketBorrowers` / `useMarketSupplies` / `useMarketBorrows` |
| Vault allocations | On-chain multicall | 30s | `useAllocationsQuery` |
| Token balances | On-chain multicall | 5 min | `useUserBalancesQuery` |
| Oracle metadata | Scanner Gist | 30 min | `useOracleMetadata` / `useAllOracleMetadata` |
| Account contract tags | Kleros Scout API | 6h stale | `useKlerosAddressTagsQuery` |
| User claimable rewards | Merkl `/rewards/summary` via `/api/merkl` | 5 min stale, forced refresh on manual refetch | `useUserRewardsQuery` |
| Market reward campaigns | Merkl API via `/api/merkl` | 5 min stale | `useMerklCampaignsQuery` |
| Market liquidations | Monarch GraphQL + Morpho API fallback | 5 min stale | `useMarketLiquidations` |
| Admin stats transactions | Monarch GraphQL + market registry/token price enrichment | 2 min stale | `useMonarchTransactions` |

### Data Hook Responsibility Matrix

This is the migration checklist for the Monarch API (Envio GraphQL endpoint). "Full Monarch support" here means the feature would still work if Morpho API reads were unavailable.

Hooks omitted from this matrix are local-state hooks or pure view/composition helpers that do not own remote transport reads.

#### Core Markets And Positions

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useMarketsQuery` | Global market registry used across the app | Monarch multi-chain first, then Morpho per supported missing chain | Optional metadata parity from Morpho plus any non-core enrichment we may keep outside the primary registry |
| `useProcessedMarkets` | Blacklist/filtering layer on top of market registry, plus RPC historical-rate enrichment and USD backfill | `useMarketsQuery` + RPC/archive snapshots + `useTokenPrices` | Inherits `useMarketsQuery`; also needs a Monarch-native token price source if we want to remove Morpho price reads |
| `useMarketData` | Single-market detail shell with freshest live state | Monarch live-state overlay on Morpho shell, then RPC snapshot override | Whitelist, supplying-vault, and rolling-APY metadata parity if we want to remove the shell fallback entirely |
| `useMarketHistoricalData` | Historical market chart series | Monarch historical snapshots first; Morpho API only for fallback | Already aligned for the current asset-only market charts |
| `useTokenPrices` | Token USD price lookup and peg fallback used by markets/admin stats | Morpho price API + major price fallback | Intentionally Morpho/major-price backed today |
| `useUserPositions` | Discover all current and exited markets where a user has positions, then attach lifetime supply aggregates and live balances | Monarch batched `Position` discovery/aggregates + RPC snapshots/oracle reads + market metadata from `useProcessedMarkets`; Morpho API and transaction-discovery fallback | Monarch market registry/detail if position objects should no longer depend on Morpho API market metadata |
| `useUserPosition` | Single-market user position | RPC snapshot first; if snapshot unavailable, Monarch position state when local market exists; then Morpho API fallback | Same market-registry/detail gap as `useUserPositions` |
| `useUserTransactionsQuery` / `fetchUserTransactions` | User history across one or many chains | Monarch user-event tables first; fallback Morpho API; `assetIds` filter still bypasses Monarch | Asset-address filtered history support to fully back reports and any asset-scoped history views |
| `useUserPositionsSummaryData` | Portfolio earnings summary for current and exited supply positions | Lifetime `Position` aggregates plus cursor-filtered recent events for all time; bounded period events + RPC boundary snapshots otherwise | Inherits the remaining `useUserPositions` and `useUserTransactionsQuery` gaps; the aggregate path requires the earnings-enabled Envio schema |
| `usePositionReport` | Asset-scoped earnings/report generation | `fetchUserTransactions(assetIds=...)` + RPC block/snapshot helpers | Still blocked on Monarch support for `assetIds`-scoped user history |
| `usePositionHistoryChart` | Derive chart points for one asset/market group | Daily net-flow buckets for all time; bounded period transactions and boundary snapshots otherwise | The daily path requires Envio `PositionDailyFlow`; a data-API join could further reduce multi-market payloads |

#### Market Detail And Admin Reads

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useMarketSuppliers` / `useMarketBorrowers` | Paginated open positions on one market | Monarch first, then Morpho API | Already Monarch-first; no new Envio schema gap identified |
| `useAllMarketSuppliers` / `useAllMarketBorrowers` | Non-paginated top positions for concentration charts | Monarch first, then Morpho API | Already Monarch-first; no new Envio schema gap identified |
| `useMarketSupplies` / `useMarketBorrows` | Paginated supply/withdraw and borrow/repay activity | Monarch first, then Morpho API | Already Monarch-first; no new Envio schema gap identified |
| `useMarketLiquidations` | Paginated liquidations | Monarch first, then Morpho API | Already Monarch-first; no new Envio schema gap identified |
| `useMonarchTransactions` | Admin stats feed and aggregated flow dashboards | Monarch transactions + `useProcessedMarkets` + `useTokenPrices` | If admin stats should be fully independent, Monarch also needs market registry/metadata and a non-Morpho price source |

#### Vaults And Allocators

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useUserVaultsV2Query` | User vault list with optional balance, TVL, and yield enrichment | Monarch vault metadata + RPC balances/totalAssets + RPC 4626 yield snapshots | Already off Morpho for yield; no new Envio schema gap identified |
| `useVaultV2Data` | Vault detail/settings metadata for a single vault | Monarch vault detail first, narrow RPC fallback if metadata unavailable | Already aligned with Monarch-first design |
| `useVaultV2RewardsQuery` | Vault detail reward APR enrichment | Merkl API opportunity lookup by vault address through `/api/merkl` | Outside Monarch/Envio scope today |
| `useAllMorphoVaultsQuery` | Global whitelisted vault registry | Morpho API only | Intentionally Morpho-only today |
| `usePublicAllocatorVaults` | Public allocator config for supplying vaults in a market | Morpho API only | Intentionally Morpho-only today |
| `useAllocationsQuery` | Live vault `allocation(capId)` values | Pure RPC multicall | No Envio gap |
| `usePublicAllocatorLiveData` | Live flow caps, vault supply, and liquidity for allocator UX | Pure RPC multicall | No Envio gap |
| `useVaultHistoryQuery` | Vault detail 6-hour native-yield, total-deposit, and share-price charts | Morpho Vault V2 historical `avgApy` + `totalAssets` + `sharePrice`; archive RPC data source for `totalAssets` + `previewRedeem` fallback | Historical vault state snapshots or an equivalent accrued-assets series; cumulative Monarch deposit/withdraw totals do not include accrued yield |
| `useVaultHistoricalApy` / `useErc4626VaultAPR` | Historical 4626 yield and expected carry calculations | Pure RPC share-price snapshots + RPC Morpho market reads | No Envio gap |

#### RPC Helpers And External Reads

| Hook / Family | Responsibility | Infra Today | Full Monarch Support Still Needs |
|---------------|----------------|-------------|----------------------------------|
| `useCurrentBlocks` / `useBlockTimestamps` / `usePositionSnapshots` / `useFreshMarketsState` / `useHistoricalSupplierPositions` | Block, snapshot, and live-state helpers used by positions/charts | Pure RPC reads via viem/wagmi | No Envio gap |
| `useUserBalancesQuery` | ERC20 wallet balances across chains | Pure RPC multicall via wagmi | No Envio gap |
| `useTokensQuery` | Token metadata lookup for app UI | Local token registry + Pendle assets API | Not part of Monarch migration |
| `useOracleMetadata` / `useAllOracleMetadata` | Oracle classification and feed metadata | Scanner gist JSON | Not part of Monarch migration |
| `useMarketMetricsQuery` | Enhanced market metrics, flows, growing signal, scores, and current backend market flags | External data API via `/v1/markets/metrics` | Already Monarch-backed; compact discovery flags use `/v1/markets/flags` |
| `useUserRewardsQuery` | User claimable rewards and Merkl proofs | Merkl API through the server-side `/api/merkl` API-key proxy | Outside Monarch/Envio scope today |
| `useMerklCampaignsQuery` / `useMerklHoldIncentivesQuery` | Market reward campaign and HOLD incentive enrichment | Merkl API through `/api/merkl` for Morpho campaign data and hardcoded HOLD opportunities | Outside Monarch/Envio scope today |

### Data Flow Patterns

**Market Data Flow:**
```
Raw API fetch → Blacklist filtering →
Split: allMarkets vs whitelistedMarkets
```

**Position Data Flow:**
```
1. Discover current and exited market keys plus lifetime supply aggregates via Monarch batched `Position` reads; fall back to Morpho API and transaction discovery
2. Fetch on-chain snapshots per market (`usePositionSnapshots`)
3. Combine live balances with market metadata from `useProcessedMarkets`
4. Group by loan asset
5. Calculate all-time earnings from lifetime aggregates plus events strictly after the indexed block/log cursor; use boundary snapshots and bounded event windows for shorter periods
6. Build all-time charts from completed sparse `PositionDailyFlow` buckets, with current balances as the live endpoint
```

**Vault Data Flow:**
```
1. Fetch chain-scoped vault metadata from Monarch GraphQL
2. Enrich user-specific balances / totalAssets via multicall where needed
3. Use narrow RPC fallback only when Monarch vault metadata is unavailable
4. Fetch live allocations from on-chain `allocation(capId)` reads
5. Fetch detail-page native yield, deposits, and share price from Morpho Vault V2 history; fall back to archive RPC reads for deposits and share price
6. After vault writes, use shared bounded retry refreshes so Monarch indexing can catch up
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
| `useVaultV2RewardsQuery` | `['vault-v2-rewards', addr, chainId]` | 5 min | - | No |
| `useUserRewardsQuery` | `['user-rewards', addr]` | 5 min | Manual forced reload | No |
| `useMerklCampaignsQuery` | `['merkl-campaigns']` | 5 min | 5 min | Yes |
| `useMarketLiquidations` | `['marketLiquidations', id, net]` | 5 min | - | Yes |
| `useUserTransactionsQuery` | `['user-transactions', ...]` | 60s | - | No |
| `useAllocationsQuery` | `['vault-allocations', ...]` | 30s | - | No |

### Data Source Switching

**File:** `/src/config/dataSources.ts`

```
supportsMorphoApi(network) returns true for:
- Mainnet, Optimism, Base, Unichain, Polygon, Arbitrum, HyperEVM, Monad

Fallback Strategy:
1. `useMarketsQuery` tries one shared Monarch market-registry read first
2. Any chain missing from that result falls back independently to Morpho API when supported
3. Unsupported or failed Morpho API chains remain empty unless Monarch returned data
4. Each network still fails independently (partial data OK)
```

### GraphQL Fetchers

**Morpho API** (`/src/data-sources/morpho-api/fetchers.ts`):
- Endpoint: `https://blue-api.morpho.org/graphql`
- `cache: 'no-store'` (disable browser cache)
- Throws on GraphQL errors (strict)

**Monarch GraphQL** (`/src/data-sources/monarch-api/fetchers.ts`):
- Endpoint: `NEXT_PUBLIC_MONARCH_API_NEW`
- Browser fetch against a public endpoint. Production Monarch origins do not send an API key; Vercel preview builds can set `NEXT_PUBLIC_MONARCH_PREVIEW_API_KEY`, which is only sent when the app runs on a `*.vercel.app` host.
- Used as the primary read path for autovault V2 metadata, market-detail live state/history/activity, and admin transaction reads

### API Key Console

- Page: `/api-keys`
- Navigation: desktop and mobile More menus
- Wallet proof: client signs a short message with `useSignMessage`; server reconstructs the message from wallet address, Mainnet chain ID, purpose, and current timestamp.
- Server route: `POST /api/api-keys`
- Verification: the Next.js route verifies wallet ownership through a viem public client so contract wallets can use ERC-1271, then calls the data gateway admin API using server-only `MONARCH_API_KEYS_ADMIN_TOKEN` and `MONARCH_API_KEYS_ADMIN_URL`.
- Created keys use the `mk_live` prefix, `data.read,indexer.query` scopes, and the free rate-limit tier. Existing-key listing and revocation are not exposed in the Monarch UI yet.

### Referrals

- Referral links are visible only on the connected wallet's own `/rewards/:account` page after signing the same Mainnet wallet-ownership proof shape used for API-key creation.
- Referral attribution runs after transaction confirmation and never blocks transaction success UI.
- Server routes use `DATA_API_INTERNAL_ORIGIN` and `DATA_API_INTERNAL_ADMIN_KEY` for data-api `/internal/*` writes. Real origins and credentials belong only in deployment secret managers or local untracked env files.

### Complete Data Flow: Market Data

```
1. useMarketData(uniqueKey, network) called
   ↓
2. Parallel queries start:
   - usePublicClient() for on-chain reads
   - useOracleMetadata() for oracle classification and feed details
   ↓
3. Market fetch:
   a. Start Monarch single-market state fetch
   b. Start Morpho API shell fallback
   c. Start on-chain snapshot (viem multicall)
   d. Merge Monarch live state into the shell when both exist
   e. Override balances / shares / liquidity with the RPC snapshot
   ↓
4. Oracle metadata resolves separately by `chainId + oracleAddress`
   - Standard/meta oracle UI reads scanner-native `OracleOutputData` / `MetaOracleOutputData`
   - No Morpho API oracle feed enrichment or local feed-shape conversion
   ↓
5. Return { data: enrichedMarket, isLoading, error }
```

### Key Patterns

1. **Feature-Scoped Priority**: Monarch-first for market detail/history/activity and the global market registry core shell, Morpho API fallback last
2. **Parallel Execution**: `Promise.all()` for multi-network
3. **Graceful Degradation**: Partial data > Error
4. **Three-Phase Market Detail**: Monarch live state + fallback shell + RPC snapshot
5. **Hybrid Reads**: Scanner metadata for oracle structure + live RPC/API for market state

---

## External Integrations

### APIs
| Service | Endpoint | Purpose |
|---------|----------|---------|
| Morpho API | `https://blue-api.morpho.org/graphql` | Markets, vaults, positions |
| Monarch GraphQL | `https://api.monarchlend.xyz/graphql` | Autovault metadata, market live state, historical charts, market detail/activity, admin transactions |
| Monarch Metrics | External data API `/v1/markets/metrics` | Market metrics and admin stats |
| Merkl API | `https://api.merkl.xyz` via `/api/merkl` | Market reward campaigns, Vault V2 reward opportunities, configured HOLD opportunity lookups, and user claimable rewards with server-side API-key auth |
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
| Optimism | 10 | 2s |
| Base | 8453 | 2s |
| Polygon | 137 | 2s |
| Arbitrum | 42161 | 0.25s |
| Unichain | 130 | 1s |
| HyperEVM | 999 | 1s |
| Monad | 143 | 0.4s |
| Katana | 747474 | 1s |

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
