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

**Context**: `src/contexts/OracleDataContext.tsx`

```typescript
const { getOracleData } = useOracleDataContext();
const oracleInfo = getOracleData(oracleAddress, network);
```

Returns oracle type (Chainlink/Redstone/Compound), feed details, deviation thresholds.

---

## Merkl Rewards Integration

**File**: `src/utils/merklApi.ts`

Fetches reward campaigns from Merkl API and matches them to Morpho markets.

**Context**: `src/contexts/MerklCampaignsContext.tsx`

**Hook**: `useMarketCampaigns(marketId, network)` in `src/hooks/useMarketCampaigns.ts`

**How it works**:
1. Fetch all campaigns from Merkl API for supported networks
2. Match campaigns to markets by checking campaign `mainParameter` (market address)
3. Cache results with TanStack Query (5min stale time)

**Display**: Reward APRs shown on market cards and detail pages

---

## Trusted by Vaults

Monarch allow users to choose which Morpho vaults they trust, and use them as filter on markets.

**Registry**: `src/contexts/VaultRegistryContext.tsx`

**Hook**: `useAllMorphoVaults()` in `src/hooks/useAllMorphoVaults.ts`
- Fetches all vaults from Morpho API
- Caches with TanStack Query

**Usage**:
```typescript
const { vaults, loading } = useVaultRegistry();
const vault = getVaultByAddress(vaultAddress, chainId);
```

**Vault data source**: `src/data-sources/morpho-api/vaults.ts`


---

## Key Directories

```
/app                    # Next.js pages (App Router)
/src
  /components           # React components
    /providers          # Context providers
  /config               # Configuration
    dataSources.ts      # Network → data source mapping
  /constants            # Static data
    /oracle             # Cached oracle feeds (JSON)
  /contexts             # React contexts (global state)
  /data-sources         # Data fetching logic
    /morpho-api         # Primary source
    /subgraph           # Fallback source
  /graphql              # GraphQL queries
  /hooks                # Custom React hooks
  /utils                # Utilities
    tokens.ts           # Token whitelist/blacklist
    merklApi.ts         # Merkl rewards integration
    networks.ts         # Supported networks + default RPCs
    subgraph-urls.ts    # Subgraph endpoints
/scripts                # Build scripts
  generate-oracle-cache.ts
  generate-chainlink-data.ts
  generate-redstone-data.ts
```

---

## Common Tasks

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
pnpm generate:redstone     # Refresh Redstone feeds
```

Commit updated JSON files in `src/constants/oracle/`

---
