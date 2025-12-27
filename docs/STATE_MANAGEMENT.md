# State Management Guide

Quick reference for choosing the right pattern.

---

## Decision Tree

```
External Data (API, blockchain) → React Query
User Preferences (persist across refresh) → Zustand + persist
Global UI State (modals, no persistence) → Zustand
Computed/Derived → useMemo Hook
Local UI State (single component) → useState
```

---

## 1. React Query

**When:** Fetching external data
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

---

## 2. Zustand Stores

### 2a. With Persist (User Preferences)

**When:** Filters, settings, preferences that should survive refresh
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

### 2b. Without Persist (Global UI State)

**When:** Modals, global UI state accessed from multiple components
**Location:** `src/stores/use{Feature}ModalStore.ts` or `src/stores/useModalStore.ts`

```typescript
export const useVaultModalStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

// Usage
const { isOpen, open, close } = useVaultModalStore();
```

---

## 3. Derived Data Hooks

**When:** Filtering, sorting, enriching data
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

---

## 4. Component State

**When:** Ephemeral UI state in a single component

```typescript
function Modal() {
  const [amount, setAmount] = useState('');
  return <Input value={amount} onChange={setAmount} />;
}
```

---

## Anti-Patterns

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

// ✅ Use Zustand for global UI state
const useModalStore = create((set) => ({ isOpen: false, open: () => set({ isOpen: true }) }));
```

```typescript
// ❌ Don't chain useEffect
useEffect(() => { setFiltered(data.filter(...)); }, [data]);
useEffect(() => { setSorted(filtered.sort(...)); }, [filtered]);

// ✅ Use useMemo
const processed = useMemo(() => data.filter(...).sort(...), [data]);
```

---

## Quick Reference

| Pattern | Use Case | Location |
|---------|----------|----------|
| React Query | External data | `src/hooks/queries/` |
| Zustand + persist | User preferences (persist) | `src/stores/` |
| Zustand | Global UI state (modals) | `src/stores/` |
| Derived Hook | Computed data | `src/hooks/` |
| useState | Local component state | Component |

**Before creating Context:**
- External data? → React Query
- Persisted preferences? → Zustand + persist
- Global UI state? → Zustand
- Computed data? → Derived hook
- Local UI? → useState
