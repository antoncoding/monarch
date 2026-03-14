# Monarch Technical Overview

## Executive Summary

Monarch is a client-side DeFi dashboard for the Morpho Blue lending protocol. It aggregates data from multiple chains (Ethereum, Base, Polygon, Arbitrum, Unichain, HyperEVM, Monad) and presents markets, vaults, and user positions in a unified interface. The app is **fully client-side** with no backend database—all user preferences persist in localStorage.

**Key Architectural Decisions:**
- Next.js 15 App Router with React 18
- Composed market data strategy: Morpho API metadata + Envio indexed state + RPC enrichment
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
  oracle?: { data: MorphoChainlinkOracleData };
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
MorphoChainlinkOracleData {
  baseFeedOne, baseFeedTwo: OracleFeed;   // Base token feeds
  quoteFeedOne, quoteFeedTwo: OracleFeed; // Quote token feeds
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

### Market Data Strategy

```
Envio/Monarch  → primary indexed market state, positions, and transactions
Morpho API     → indexed fallback + separate market metadata
RPC            → fresh snapshots and derived enrichments
Subgraph       → kept only for Vault V2 / adapter discovery
```

### Static Data (Build-time or cached)
| Data Type | Source | Location |
|-----------|--------|----------|
| Oracle definitions | Pre-generated | `/src/constants/oracle/oracle-cache.json` |
| Chainlink feeds | Pre-generated | `/src/constants/oracle/chainlink/` |
| Redstone feeds | Pre-generated | `/src/constants/oracle/redstone/` |
| Network configs | Hardcoded | `/src/utils/networks.ts` |
| Default blacklist | Hardcoded | `/src/constants/markets/blacklisted.ts` |

### Dynamic Data (Runtime fetched)
| Data Type | Source | Refresh | Query Hook |
|-----------|--------|---------|------------|
| Markets list | Envio + Morpho fallback + RPC enrichment | 5 min stale | `useMarketsQuery` |
| Market metrics (flows, trending) | Monarch API | 5 min stale | `useMarketMetricsQuery` |
| Market state (APY, utilization) | Envio + Morpho fallback + on-chain | 30s stale | `useMarketData` |
| User positions | Envio/Morpho + on-chain | 5 min | `useUserPositions` |
| Vaults list | Morpho API | 5 min | `useAllMorphoVaultsQuery` |
| Vault allocations | On-chain (Wagmi) | On demand | `useAllocations` |
| Token balances | On-chain multicall | 5 min | `useUserBalancesQuery` |
| Oracle prices | Morpho API | 5 min | `useOracleDataQuery` |
| Merkl rewards | Merkl API | On demand | `useMerklCampaignsQuery` |
| Market liquidations | Envio/Morpho | 5 min stale | `useMarketLiquidations` |

### Data Flow Patterns

**Market Data Flow:**
```
1. Fetch indexed market state from Envio, or fall back to Morpho API
2. Apply blacklist and USD/target-rate/historical APY enrichments
3. Fetch Morpho market metadata separately (warnings, trusted-by / supplying vaults)
4. Recombine metadata at the hook layer for UI consumers that need it
5. Split: allMarkets vs whitelistedMarkets
```

**Position Data Flow:**
```
1. Discover user position markets from cross-chain Envio or cross-chain Morpho fallback
2. Fetch on-chain snapshots per chain (usePositionSnapshots)
3. Combine with market metadata
4. Group by loan asset
5. Calculate earnings
```

**Vault Data Flow:**
```
1. Fetch vault list from API
2. Wagmi contract reads for owner, curator, caps
3. Historical allocations via subgraph
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
| `useMarketsQuery` | `['markets', rpcConfigVersion]` | 5 min | 5 min | Yes |
| `useMarketMetricsQuery` | `['market-metrics', ...]` | 5 min | 5 min | No |
| `useTokensQuery` | `['tokens']` | 5 min | 5 min | Yes |
| `useOracleDataQuery` | `['oracle-data']` | 5 min | 5 min | Yes |
| `useUserBalancesQuery` | `['user-balances', addr, networks]` | 30s | - | Yes |
| `useUserVaultsV2Query` | `['user-vaults-v2', addr]` | 60s | - | Yes |
| `useMarketLiquidations` | `['marketLiquidations', id, net]` | 5 min | - | Yes |
| `useUserTransactionsQuery` | `['user-transactions', ...]` | 60s | - | No |
| `useAllocationsQuery` | `['vault-allocations', ...]` | 30s | - | No |

### Data Source Composition

**File:** `/src/config/dataSources.ts`

```
Envio endpoint present:
- use Envio for indexed state/events/positions/history when available

Market reads:
- use Envio first for indexed market data
- fall back to Morpho-only indexed data if Envio fails
- fetch Morpho market metadata separately for warnings / supplying vaults

Position/history reads:
- use cross-chain Envio first
- fall back to cross-chain Morpho
```

### GraphQL Fetchers

**Morpho API** (`/src/data-sources/morpho-api/fetchers.ts`):
- Endpoint: `https://blue-api.morpho.org/graphql`
- `cache: 'no-store'` (disable browser cache)
- Throws on GraphQL errors (strict)

**Subgraph** (`/src/data-sources/subgraph/fetchers.ts`):
- Used only for Vault V2 / adapter discovery
- Configurable URL per network

### Complete Data Flow: Market Data

```
1. useMarketData(uniqueKey, network) called
   ↓
2. Parallel queries start:
   - usePublicClient() for on-chain reads
   - useOracleDataQuery() for oracle enrichment
   - useMarketMetadataQuery() for Morpho metadata
   ↓
3. Market fetch:
   a. Try on-chain snapshot (viem multicall)
   b. Fetch indexed market details (Envio first, Morpho fallback)
   c. Merge snapshot with indexed state
   ↓
4. Recombine metadata + oracle enrichment via useMemo()
   ↓
5. Return { data: enrichedMarket, isLoading, error }
```

### Key Patterns

1. **Split Indexed Data From Metadata**: indexed state and metadata are fetched separately and recombined only at shared hook boundaries
2. **Envio First For Indexed Reads**: Morpho API is fallback-only for market/position/history state
3. **Cross-Chain First**: adapter boundaries accept multiple chains and own pagination internally
4. **Chain-Scoped Identity**: market and transaction identity uses `chainId + uniqueKey`
5. **RPC Loops Only Where Necessary**: snapshots and historical enrichments stay per chain
6. **Graceful Degradation**: fallback indexed data beats empty, and metadata failure must not blank primary state

---

## External Integrations

### APIs
| Service | Endpoint | Purpose |
|---------|----------|---------|
| Morpho API | `https://blue-api.morpho.org/graphql` | Market metadata, vaults, fallback positions/history |
| Envio / Monarch indexer | Configured via `NEXT_PUBLIC_ENVIO_INDEXER_ENDPOINT` | Indexed markets, positions, participants, transactions |
| The Graph | Per-chain subgraph URLs | Vault V2 / adapter discovery only |
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
