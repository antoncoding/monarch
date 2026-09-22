---
name: data-and-state-management
description: Core patterns for data fetching, state management, and user preferences. Use when implementing new features that require getting data from Our APIs, Morpho API, on-chain states or managing shared state.
---


## Quick Reference

### State Management Decision Tree

```
External Data (API, blockchain) → React Query
User Preferences (persist across refresh) → Zustand + persist
Shared UI State (modals, selections, operations) → Zustand
Computed/Derived → useMemo Hook
Local UI State (single component) → useState
```

## Detailed Patterns

### Data Flow

```
1. Try Morpho API (if network supported)
   ↓ fails
2. Fallback to The Graph Subgraph
   ↓ optional
3. Enhance with on-chain RPC data
```


### API Outcome Contracts

Read the shared fetcher's return/error contract before writing a caller; do not infer domain meaning from truthiness.

- Confirmed absence: return `[]` for a collection lookup or `null` for a nullable entity lookup. An absent user on one chain must not reject holdings from another chain.
- Unavailable data: transport, timeout, decoding, unexpected GraphQL errors, and missing required fields reject. Do not turn them into successful empty results.
- Morpho specifically: `morphoGraphqlFetcher` returns `null` for NOT_FOUND-only responses without data and preserves partial data when the remaining fields are valid. Explicit `userByAddress: null` means an absent user; a missing field or null positions list on a present user is malformed.
- A response with both NOT_FOUND and another GraphQL error must reject. Do not let one recognized absence mask another failure.
- A background failure retains last-good rows and totals and shows a refresh warning/retry. Price failures still prevent presenting unverified USD totals.
- Test the real fetcher/caller boundary with raw success, empty, NOT_FOUND, explicit entity null, malformed, mixed-error, and mixed-chain payloads. Use store actions in state-transition tests; never mutate snapshots or objects already used in query keys.

Run `pnpm test:contracts` for the shared API and vault position contracts.

### React Query (External Data)

**Location:** `src/hooks/queries/use{Entity}Query.ts`

```typescript
export const useMarketsQuery = () => {
  return useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
    staleTime: 5 * 60 * 1000,
  });
};

// Usage
const { data, isLoading } = useMarketsQuery();
```

### Zustand + Persist (User Preferences)

**Location:** `src/stores/use{Feature}{State}.ts`

```typescript
export const useMarketsFilters = create(
  persist(
    (set) => ({
      selectedNetwork: null,
      setSelectedNetwork: (network) => set({ selectedNetwork: network }),
    }),
    { name: 'monarch_store_marketsFilters' }
  )
);

// Usage - separate selectors for primitives
const network = useMarketsFilters((s) => s.selectedNetwork);
const setNetwork = useMarketsFilters((s) => s.setSelectedNetwork);
```

### Zustand (Shared UI State)

**Location:** `src/stores/use{Feature}Store.ts`

```typescript
// Modal state
export const useVaultModalStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

// Selection state
export const useTableSelectionStore = create((set) => ({
  selectedIds: [],
  toggleSelection: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((i) => i !== id)
      : [...state.selectedIds, id]
  })),
  clearSelection: () => set({ selectedIds: [] }),
}));
```

### Derived Data Hooks

**Location:** `src/hooks/use{Processed|Filtered}{Entity}.ts`

```typescript
export const useFilteredMarkets = () => {
  const { data } = useMarketsQuery();
  const searchQuery = useMarketsFilters((s) => s.searchQuery);

  return useMemo(() => {
    return data
      .filter((m) => m.symbol.includes(searchQuery))
      .sort((a, b) => b.tvl - a.tvl);
  }, [data, searchQuery]);
};
```

### Anti-Patterns

```typescript
// ❌ Don't fetch in Context
const Provider = () => {
  useEffect(() => { fetch().then(setData); }, []);
  return <Context.Provider value={data}>{children}</Context.Provider>;
};
// ✅ Use React Query
const useDataQuery = () => useQuery({ queryKey: ['data'], queryFn: fetch });
```

```typescript
// ❌ Don't create objects in selectors (infinite loop)
const filters = useStore((s) => s.filters ?? { min: '0' });
// ✅ Return primitives
const min = useStore((s) => s.filters?.min ?? '0');
```

```typescript
// ❌ Don't use useState for shared state
const [modalOpen, setModalOpen] = useState(false);
// Then pass through 3 levels of props...
// ✅ Use Zustand for shared UI state
const useModalStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
}));
```

```typescript
// ❌ Don't chain useEffect
useEffect(() => { setFiltered(data.filter(...)); }, [data]);
useEffect(() => { setSorted(filtered.sort(...)); }, [filtered]);
// ✅ Use useMemo
const processed = useMemo(() => data.filter(...).sort(...), [data]);
```

---
