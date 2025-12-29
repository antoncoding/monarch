# Monarch Architecture

Technical reference for Monarch's key configurations and integrations.

---

## System Overview

Monarch is an interface for Morpho Blue lending markets with maximized customizability:

- **Dual data sources**: Morpho API (primary) → Subgraph (fallback)
- **Custom RPCs**: User-configurable per-network RPC endpoints
- **Oracle integration**: Parsing Chainlink, Redstone, and Compound price feeds
- **Token management**: Whitelist system
- **Merkl rewards**: External rewards campaign integration
- **Trusted-vaults filters**: Allow filtering through customizable vaults

**Tech stack**: React 18 · Next.js 15 · TypeScript · Wagmi · TanStack Query · Biome

**State management**: See [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) for React Query + Zustand patterns

**Data prefetching**: Critical queries (markets, tokens, campaigns, oracles) prefetch on app mount via `DataPrefetcher` component for instant navigation

---

## Data Sources

### Morpho API vs Subgraph

Data fetching uses a fallback pattern for reliability:

```
1. Try Morpho API (if network supported)
   ↓ fails
2. Fallback to The Graph Subgraph
   ↓ optional
3. Enhance with on-chain RPC data
```

**Network support config**: `src/config/dataSources.ts`

```typescript
export const supportsMorphoApi = (network: SupportedNetworks): boolean => {
  // Returns true for: Mainnet, Base, Unichain, Polygon, Arbitrum, HyperEVM, Monad
  // Returns false for networks without Morpho API support
};
```

**Data source files**:
- `src/data-sources/morpho-api/` - Primary GraphQL fetchers
- `src/data-sources/subgraph/` - Fallback GraphQL fetchers

**Subgraph URLs**: `src/utils/subgraph-urls.ts`

---

## Custom RPC Configuration

Users can override default RPC endpoints per network.

**Implementation**: `src/hooks/useCustomRpc.ts`

```typescript
const { customRpcUrls, setRpcUrl, resetRpcUrl } = useCustomRpc();

// Set custom RPC for a network
setRpcUrl(SupportedNetworks.Mainnet, 'https://my-custom-rpc.com');

// Reset to default
resetRpcUrl(SupportedNetworks.Mainnet);
```

**Storage**: RPC URLs stored in browser localStorage under key `customRpcUrls`

**Provider integration**: `src/components/providers/CustomRpcProvider.tsx` wraps Wagmi config

**Default RPCs**: `src/utils/networks.ts` - `getDefaultRPC(chainId)`

---

## Token Management

### Token Whitelist

**File**: `src/utils/tokens.ts`

Defines all supported tokens with:
- Symbol, decimals, icon
- Multi-network addresses
- Optional protocol info
- Price peg (USD, ETH, BTC) for estimation

**Example**:
```typescript
{
  symbol: 'USDC',
  decimals: 6,
  networks: [
    { chain: mainnet, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    { chain: base, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  ],
  peg: TokenPeg.USD,
}
```

### Finding Tokens

**Function**: `findToken(address, chainId)` in `src/utils/tokens.ts`

Returns token metadata if whitelisted, `undefined` otherwise.

---

## Oracle Configuration

Oracle price feed data is **pre-cached** to avoid runtime API calls.

### Oracle Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `generate-oracle-cache.ts` | Fetches all oracles from Morpho API, generates master cache |
| `generate-chainlink-data.ts` | Fetches Chainlink feed metadata per network |
| `generate-redstone-data.ts` | Fetches Redstone feed metadata per network |

**Run oracle sync**:
```bash
pnpm generate:oracle       # Master cache
pnpm generate:chainlink    # Chainlink feeds
pnpm generate:redstone     # Redstone feeds
```

### Oracle Cache Files

**Master cache**: `src/constants/oracle/oracle-cache.json`
- All oracle addresses mapped to their metadata
- Indexed by network and oracle address

**Chainlink data**: `src/constants/oracle/chainlink-data/{network}.json`
- Per-network Chainlink feed configurations
- Includes deviation thresholds, heartbeat

**Redstone data**: `src/constants/oracle/redstone-data/{network}.json`
- Per-network Redstone feed configurations

**Compound data**: `src/constants/oracle/compound/` (manually curated)

### Using Oracle Data

**Hook**: `src/hooks/queries/useOracleDataQuery.ts`

```typescript
const { getOracleData } = useOracleDataQuery();
const oracleInfo = getOracleData(oracleAddress, network);
```

Returns oracle type (Chainlink/Redstone/Compound), feed details, deviation thresholds.

---

## Merkl Rewards Integration

**File**: `src/utils/merklApi.ts`

Fetches reward campaigns from Merkl API and matches them to Morpho markets.

**Hook**: `useMerklCampaignsQuery()` in `src/hooks/queries/useMerklCampaignsQuery.ts`

**Derived hook**: `useMarketCampaigns(marketId, network)` in `src/hooks/useMarketCampaigns.ts`

**How it works**:
1. Fetch all campaigns from Merkl API for supported networks
2. Match campaigns to markets by checking campaign `mainParameter` (market address)
3. Cache results with React Query (5min stale time)

**Display**: Reward APRs shown on market cards and detail pages

---

## Trusted by Vaults

Monarch allow users to choose which Morpho vaults they trust, and use them as filter on markets.

**Registry**: `src/contexts/VaultRegistryContext.tsx`

**Hook**: `useAllMorphoVaultsQuery()` in `src/hooks/queries/useAllMorphoVaultsQuery.ts`
- Fetches all vaults from Morpho API
- Caches with TanStack Query

**Usage**:
```typescript
const { vaults, loading } = useVaultRegistry();
const vault = getVaultByAddress(vaultAddress, chainId);
```

**Vault data source**: `src/data-sources/morpho-api/vaults.ts`


---

## Transaction Pattern

**ExecuteTransactionButton** handles wallet connection + chain switching automatically.

**Standard Pattern**:
```typescript
// 1. Transaction hook (approval + execution logic)
const { approveAndExecute, signAndExecute, isLoading } = useXTransaction({ ... });

// 2. Named callback with useCallback
const handleExecute = useCallback(() => {
  if (!isApproved) {
    void approveAndExecute();
  } else {
    void signAndExecute();
  }
}, [isApproved, approveAndExecute, signAndExecute]);

// 3. ExecuteTransactionButton (handles connection/chain switching)
<ExecuteTransactionButton
  targetChainId={chainId}
  onClick={handleExecute}
  isLoading={isLoading}
  disabled={!amount}
>
  Execute
</ExecuteTransactionButton>
```

**Dynamic Button Text**:
```typescript
const getButtonText = () => {
  if (isDeploying) return 'Deploying...';
  if (!ready) return 'Select Item';
  return 'Execute';
};

<ExecuteTransactionButton onClick={handleExecute}>
  {getButtonText()}
</ExecuteTransactionButton>
```

**Rules**:
- Always use `useCallback` for onClick handlers
- Never put complex logic directly in `onClick`
- Button shows "Connect Wallet" / "Switch Chain" / action text automatically

---

## Component Architecture

Monarch follows a **feature-based architecture** optimized for Next.js 15 App Router best practices.

### Core Principles

**1. `app/` is for Routing, `src/` is for Logic**

The `app/` directory is a thin routing layer. Each `page.tsx` file:
- Exports metadata for SEO
- Handles URL parameters (server-side)
- Renders a single "View" component from `src/features/`

**Example** (`app/markets/page.tsx`):
```typescript
import { MarketsView } from '@/features/markets/markets-view';

export const metadata = { title: 'Markets' };

export default function Page() {
  return <MarketsView />;
}
```

**2. Features Group Related Logic**

Each feature in `src/features/` contains:
- Main view component (`{feature}-view.tsx`)
- Supporting components (`components/`)
- Feature-specific hooks (`hooks/`)
- Feature-specific utilities (`utils/`)

**3. Clear Component Hierarchy**

```
src/components/
├── ui/           # Design system primitives (Button, Badge, Spinner)
├── shared/       # Cross-feature, business-agnostic components
├── layout/       # Layout wrappers (Header, Footer)
└── providers/    # Context providers
```

### Feature Structure

Each feature follows this pattern:

```
src/features/{feature-name}/
├── {feature-name}-view.tsx    # Main orchestrator (replaces old "Content")
├── components/                 # Feature-specific components
│   ├── filters/               # Grouped by responsibility
│   ├── table/
│   └── {component}.tsx
├── hooks/                     # Feature-specific hooks (optional)
└── utils/                     # Feature-specific utilities (optional)
```

**Current Features**:
- `markets/` - Market listing, filtering, settings
- `market-detail/` - Individual market pages (borrowers, suppliers, transactions)
- `positions/` - User positions, rebalancing, onboarding
- `positions-report/` - Position reporting
- `autovault/` - Vault listing, deployment, vault detail pages
- `rewards/` - Rewards tracking
- `history/` - Transaction history
- `admin/` - Admin dashboard

### Global Modals

Modals triggered from multiple places live in `src/modals/`:

```
src/modals/
├── supply/                    # Supply & withdraw flow
├── borrow/                    # Borrow & repay flow
├── settings/                  # Settings modals
├── wrap-process-modal.tsx
└── risk-notification-modal.tsx
```

### Component Guidelines

**When to use `src/components/ui/`**:
- Zero business logic
- Purely presentational (Button, Badge, Table)
- Shadcn/Radix primitives

**When to use `src/components/shared/`**:
- Reusable across multiple features
- Business-agnostic (TokenIcon, AccountIdentity, TablePagination)
- No domain-specific logic

**When to use `src/features/{feature}/components/`**:
- Feature-specific component
- Contains domain logic for that feature
- Used only within that feature's pages

**When to use `src/modals/`**:
- Modal triggered from multiple locations
- Global state-managed modals
- Complex multi-step flows (supply, borrow)

---

## Common Tasks

### Adding a New Page/Feature

1. **Create the page route** in `app/{feature}/page.tsx`:
   ```typescript
   import { FeatureView } from '@/features/{feature}/{feature}-view';

   export const metadata = { title: 'Feature Name' };

   export default function Page() {
     return <FeatureView />;
   }
   ```

2. **Create the feature directory** in `src/features/{feature}/`:
   ```
   src/features/{feature}/
   ├── {feature}-view.tsx     # Main view component
   └── components/             # Feature-specific components
   ```

3. **Build the view component** (`{feature}-view.tsx`):
   - Add `'use client'` if using hooks/state
   - Import shared components from `@/components/shared/`
   - Import UI primitives from `@/components/ui/`
   - Keep feature logic self-contained

### Adding a New Component

**Ask yourself**: Where does this component belong?

1. **Is it a pure UI primitive?** → `src/components/ui/`
   - No business logic
   - Highly reusable (Button, Input, Card)
   - Example: `button.tsx`, `badge.tsx`

2. **Is it reusable across features but not a primitive?** → `src/components/shared/`
   - Business-agnostic
   - Used in 2+ features
   - Example: `token-icon.tsx`, `account-identity.tsx`

3. **Is it specific to one feature?** → `src/features/{feature}/components/`
   - Contains domain logic
   - Only used in one feature
   - Example: `markets/components/market-identity.tsx`

4. **Is it a global modal?** → `src/modals/`
   - Triggered from multiple places
   - Multi-step flows
   - Example: `supply/supply-modal.tsx`

### Adding a New Token

1. Add token to `src/utils/tokens.ts` in the `supportedTokens` array
2. Include symbol, decimals, icon path, network addresses
3. Optionally set `peg` for USD estimation

### Adding a Network

1. Add to `SupportedNetworks` enum in `src/utils/networks.ts`
2. Update `supportsMorphoApi()` in `src/config/dataSources.ts`
3. Add subgraph URL to `src/utils/subgraph-urls.ts` (if available)
4. Add default RPC to `getDefaultRPC()` in `src/utils/networks.ts`
5. Run oracle scripts to generate cache for new network

### Refreshing Oracle Data

```bash
pnpm generate:oracle       # Refresh all oracles
pnpm generate:chainlink    # Refresh Chainlink feeds
pnpm generate:redstone     # Redstone feeds
```

Commit updated JSON files in `src/constants/oracle/`

---
