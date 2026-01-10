# Monarch Developer Guide

Consolidated reference for state management, components, and architecture.

---

## 1. Quick Reference

### State Management Decision Tree

```
External Data (API, blockchain) → React Query
User Preferences (persist across refresh) → Zustand + persist
Shared UI State (modals, selections, operations) → Zustand
Computed/Derived → useMemo Hook
Local UI State (single component) → useState
```

### Component Location Rules

```
src/components/ui/       → Pure UI primitives (Button, Badge, Table)
src/components/shared/   → Cross-feature components (TokenIcon, AccountIdentity)
src/features/{name}/     → Feature-specific components
src/modals/              → Global modals (multi-trigger)
```

### Modal Pattern Decision

```
Single trigger, depth 0-1           → Local state (useState)
Multi-trigger (2+ places)           → Zustand (useModal hook)
Props drilling pain (3+ levels)     → Zustand
Modal chaining                      → Zustand
```

### File Naming

- Stores: `src/stores/use{Feature}{State}.ts`
- Queries: `src/hooks/queries/use{Entity}Query.ts`
- Derived hooks: `src/hooks/use{Processed|Filtered}{Entity}.ts`
- Features: `src/features/{name}/{name}-view.tsx`

---

## 2. State Management

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

## 3. Component Usage Guide

### Modal

**Import:** `@/components/common/Modal`

Always use our custom Modal components. The shared wrapper applies Monarch typography, corner radius, background, blur, and z-index rules automatically.

#### Modal Systems

| System | Use Case | How It Works |
|--------|----------|--------------|
| Local `useState` | Simple, single-trigger modals | Component controls own visibility |
| `useModalStore` | Multi-trigger, nested, or chained modals | Zustand store, `ModalRenderer` in layout |
| `GlobalModalContext` | Imperative generic modals | Call `openModal(<Content />)`, renders in provider |
| `GlobalTransactionModals` | Transaction progress | Reactive to `useTransactionProcessStore`, auto-renders |

**Decision:**
- Settings, confirmations, forms → `useModalStore` or local state
- Transaction progress → Use `useTransactionTracking`, modal handled automatically
- Dynamic content injection → `GlobalModalContext`

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
```

#### Standard Modal (settings, workflows)

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  variant="standard"
  zIndex="settings"
  size="xl"
>
  <ModalHeader
    title="Modal Title"
    description="Brief description of what this modal does"
  />
  <ModalBody>
    {/* Modal content */}
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="cta" onClick={handleConfirm}>Confirm</Button>
  </ModalFooter>
</Modal>
```

#### Compact Modal (filters, confirmations)

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  variant="compact"
  zIndex="base"
  size="md"
>
  <ModalHeader variant="compact" title="Filter Options" />
  <ModalBody variant="compact">
    {/* Tighter spacing applied automatically */}
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
    <Button variant="cta" size="sm" onClick={handleApply}>Apply</Button>
  </ModalFooter>
</Modal>
```

#### With Icon

```tsx
<ModalHeader
  title={`Supply ${symbol}`}
  description="Supply to earn interest"
  icon={<TokenIcon address={tokenAddress} chainId={chainId} symbol={symbol} width={20} height={20} />}
/>
```

#### Z-Index Layers

```tsx
zIndex="base"      // z-50   - Standard modals (Supply, Borrow)
zIndex="process"   // z-1100 - Process/transaction modals
zIndex="selection" // z-2200 - Market/item selection modals
zIndex="settings"  // z-2300 - Settings modals (HIGHEST)
```

#### Modal State Patterns

**Pattern 1: Local State (Default)**
```tsx
const [showModal, setShowModal] = useState(false);
{showModal && <MyModal isOpen={showModal} onClose={() => setShowModal(false)} />}
```

**Pattern 2: Global State (Zustand)**
```tsx
const { open } = useModalStore();
<Button onClick={() => open('supply', { market, position })}>Supply</Button>
```

Use Pattern 2 when: multi-trigger (2+ places), props drilling pain, modal chaining, or **nested modals**.

⚠️ **Nested modals must use Pattern 2.** Radix-UI crashes with "Maximum update depth exceeded" when multiple Dialogs are mounted simultaneously ([#3675](https://github.com/radix-ui/primitives/issues/3675)). The modal store avoids this by only mounting visible modals.

---

### SectionTag

**Import:** `@/components/landing`

A minimal label component for section headers with a technical, bracketed style.

```tsx
import { SectionTag } from '@/components/landing';

// Basic usage
<SectionTag>Account Access</SectionTag>

// With custom className
<SectionTag className="mb-4">Market Analysis</SectionTag>
```

**Use cases:**
- Landing page section labels

---

### Button

**Import:** `@/components/ui/button`

```tsx
import { Button } from '@/components/ui/button';

// Primary - main actions
<Button variant="primary" size="md">New Position</Button>

// Surface - actions in cards, tables
<Button variant="surface" size="sm">Claim</Button>

// Default - navigation
<Button variant="default" size="md">Back to Markets</Button>

// Ghost - icon buttons
<Button variant="ghost" size="icon"><RefreshIcon /></Button>
```

**Variants:** `primary` | `surface` | `default` | `ghost`
**Sizes:** `xs` | `sm` | `md` | `lg` | `icon`

When wrapping Button in Tooltip, wrap it in a `<span>` to prevent ResizeObserver errors.

---

### RefetchIcon

**Import:** `@/components/ui/refetch-icon`

Spinning reload icon with smooth animation completion. When `isLoading` becomes false, the icon completes its current rotation before stopping. Use isLoading with data refetching states as well.

```tsx
import { RefetchIcon } from '@/components/ui/refetch-icon';

// Inside a button
<Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefetching}>
  <RefetchIcon isLoading={isRefetching} />
</Button>

// Custom size
<RefetchIcon isLoading={isLoading} className="h-4 w-4" />
```

---

### Table

**Import:** `@/components/ui/table`

Never use raw HTML `<table>` tags.

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/common/TablePagination';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="text-left">Name</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody className="table-body-compact">
    <TableRow>
      <TableCell>John</TableCell>
      <TableCell className="text-right">$100</TableCell>
    </TableRow>
  </TableBody>
</Table>

<TablePagination
  currentPage={page}
  totalPages={totalPages}
  totalEntries={items.length}
  pageSize={10}
  onPageChange={setPage}
  isLoading={loading}
/>
```

**Rules:**
- Use `table-body-compact` on `<TableBody>` for activity tables
- Headers and cells must match alignment (`text-left`, `text-right`, `text-center`)
- Amount columns: use flexbox with `justify-end`

---

### TableContainerWithHeader

**Import:** `@/components/common/table-container-with-header`

```tsx
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';

// Simple
<TableContainerWithHeader title="Asset Activity">
  <Table>{/* content */}</Table>
</TableContainerWithHeader>

// With actions
<TableContainerWithHeader
  title="Supplied Positions"
  actions={
    <>
      <Button variant="ghost" size="sm" onClick={handleRefresh}>
        <RefreshIcon className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm">
        <SettingsIcon className="h-3 w-3" />
      </Button>
    </>
  }
>
  <Table>{/* content */}</Table>
</TableContainerWithHeader>
```

**Props:** `title`, `actions?`, `children`, `className?`

---

### TablePagination

**Import:** `@/components/common/TablePagination`

```tsx
import { TablePagination } from '@/components/common/TablePagination';

<TablePagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalEntries={data.length}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  isLoading={isFetching}
  showEntryCount={true}  // Optional, default true
/>
```

**Props:** `currentPage`, `totalPages`, `totalEntries`, `pageSize`, `onPageChange`, `isLoading?`, `showEntryCount?`

---

### Tooltip

**Import:** `@/components/ui/tooltip`

```tsx
import { Tooltip } from '@/components/ui/tooltip';

// Basic
<Tooltip content="Tooltip text">
  <Button>Hover me</Button>
</Tooltip>

// With placement and delay
<Tooltip content="Top tooltip" placement="top" delay={500}>
  <span>Hover</span>
</Tooltip>
```

#### Structured Content

```tsx
import { TooltipContent } from '@/components/shared/tooltip-content';

<Tooltip
  content={
    <TooltipContent
      icon={<Icon />}
      title="Title"
      detail="Detail text"
      secondaryDetail="Secondary detail"
    />
  }
>
  <Button>Hover</Button>
</Tooltip>
```

**Props:** `content`, `placement` (`top` | `bottom` | `left` | `right`), `delay` (ms)
**TooltipContent Props:** `icon`, `title`, `detail`, `secondaryDetail`, `actionIcon`, `actionHref`

---

### Switch

**Import:** `@/components/ui/icon-switch`

```tsx
import { IconSwitch } from '@/components/ui/icon-switch';

// Plain switch
<IconSwitch
  size="xs"
  selected={isEnabled}
  onChange={setIsEnabled}
  thumbIcon={null}
/>

// With icon
<IconSwitch
  size="sm"
  selected={viewMode === 'user'}
  onChange={toggleView}
  thumbIcon={ViewIcon}
/>
```

**Sizes:** `xs` | `sm` | `md` | `lg`

---

### Checkbox

**Import:** `@/components/ui/checkbox`

```tsx
import { Checkbox } from '@/components/ui/checkbox';

<Checkbox
  checked={isChecked}
  onCheckedChange={setIsChecked}
  label="Accept terms"
/>

<Checkbox
  variant="highlighted"
  checked={isSelected}
  onCheckedChange={setIsSelected}
  label="Enable advanced features"
/>
```

**Variants:** `default` | `highlighted`

---

### Dropdown Menu

**Import:** `@/components/ui/dropdown-menu`

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleAction}>Action</DropdownMenuItem>
    <DropdownMenuItem startContent={<Icon />}>With Icon</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked={isChecked} onCheckedChange={setIsChecked}>
      Toggle Item
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Alignment:** `align="start"` | `"center"` | `"end"`

---

### Input

#### Numerical Inputs (Amounts)

```tsx
import Input from '@/components/Input/Input';

<Input
  decimals={18}
  setValue={setAmount}
  max={maxBalance}
  setError={setError}
  value={currentAmount}
  onMaxClick={handleMaxClick}
/>
```

#### Text Inputs

```tsx
<input
  type="text"
  placeholder="Enter text..."
  value={inputValue}
  onChange={(e) => handleChange(e.target.value)}
  className="bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none"
/>
```

#### Error States

```tsx
className={`bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none ${
  error ? 'border border-red-500 focus:border-red-500' : ''
}`}

{error && <p className="text-sm text-red-500">{error}</p>}
```

---

### AccountIdentity

**Import:** `@/components/common/AccountIdentity`

```tsx
import { AccountIdentity } from '@/components/common/AccountIdentity';

// Badge - minimal inline (no avatar)
<AccountIdentity address={address} variant="badge" />

// Compact - small avatar + text in badge
<AccountIdentity address={address} variant="compact" chainId={1} />

// Full - avatar + address badge + extra info badges
<AccountIdentity address={address} variant="full" showAddress />
```

**Variants:** `badge` | `compact` | `full`

---

### MarketIdentity

**Import:** `@/components/MarketIdentity`

```tsx
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';

// Normal mode - both assets shown equally
<MarketIdentity market={market} chainId={chainId} mode={MarketIdentityMode.Normal} />

// Focused mode - emphasizes one asset
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Focused}
  focus={MarketIdentityFocus.Collateral}
/>

// Minimum mode - only focused asset
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Minimum}
  focus={MarketIdentityFocus.Loan}
  showLltv
  showOracle
/>
```

**Modes:** `Normal` | `Focused` | `Minimum`

---

### MarketDetailsBlock

**Import:** `@/components/common/MarketDetailsBlock`

```tsx
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';

<MarketDetailsBlock
  market={market}
  mode="supply"
  defaultCollapsed
  showRewards
/>
```

---

### TransactionIdentity

**Import:** `@/components/common/TransactionIdentity`

```tsx
import { TransactionIdentity } from '@/components/common/TransactionIdentity';

<TransactionIdentity txHash={txHash} chainId={chainId} />
<TransactionIdentity txHash={txHash} chainId={chainId} showFullHash />
```

---

### CollateralIconsDisplay

**Import:** `@/features/positions/components/collateral-icons-display`

```tsx
import { CollateralIconsDisplay } from '@/features/positions/components/collateral-icons-display';

<CollateralIconsDisplay
  collaterals={position.collaterals}
  chainId={position.chainId}
  maxDisplay={8}
  iconSize={20}
/>
```

**Props:** `collaterals`, `chainId`, `maxDisplay?` (default 8), `iconSize?` (default 20)

---

### Toast

**Import:** `@/hooks/useStyledToast`

```tsx
import { useStyledToast } from '@/hooks/useStyledToast';

const { success, error } = useStyledToast();

success('Success', 'Detail of the success');
error('Error', 'Detail of the error');
```

---

## 4. Architecture

### Tech Stack

React 18 · Next.js 15 · TypeScript · Wagmi · TanStack Query · Biome

### Feature Structure

```
src/features/{feature-name}/
├── {feature-name}-view.tsx    # Main orchestrator
├── components/                 # Feature-specific components
│   ├── filters/
│   ├── table/
│   └── {component}.tsx
├── hooks/                     # Feature-specific hooks (optional)
└── utils/                     # Feature-specific utilities (optional)
```

### Component Hierarchy

```
src/components/
├── ui/           # Design system primitives (Button, Badge, Spinner)
├── shared/       # Cross-feature, business-agnostic components
├── common/       # Common layout components (Modal, TableContainer)
├── layout/       # Layout wrappers (Header, Footer)
└── providers/    # Context providers
```

### Data Flow

```
1. Try Morpho API (if network supported)
   ↓ fails
2. Fallback to The Graph Subgraph
   ↓ optional
3. Enhance with on-chain RPC data
```

### Transaction Pattern

```typescript
// 1. Transaction hook
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

### Transaction Tracking & Process Modal

Multi-step transactions use `useTransactionTracking` + `GlobalTransactionModals` for persistent progress UI.

**Architecture:**
```
useTransactionTracking (hook)
    ↓ writes to
useTransactionProcessStore (Zustand)
    ↓ watched by
GlobalTransactionModals (renders ProcessModal)
    ↓ background txs shown in
TransactionIndicator (navbar indicator)
```

**Usage in transaction hooks:**

```typescript
import { useTransactionTracking } from '@/hooks/useTransactionTracking';

export function useSupplyTransaction(market: Market, onSuccess?: () => void) {
  const tracking = useTransactionTracking('supply');

  const steps = [
    { id: 'approve', title: 'Approve Token', description: 'Approving...' },
    { id: 'signing', title: 'Sign Message', description: 'Sign in wallet' },
    { id: 'supplying', title: 'Confirm Supply', description: 'Confirm tx' },
  ];

  const execute = async () => {
    // Start tracking - modal appears automatically
    tracking.start(steps, {
      title: `Supply ${market.loanAsset.symbol}`,        // Required
      description: `Supplying to market`,                // Optional
      tokenSymbol: market.loanAsset.symbol,              // Optional metadata
    }, 'approve');

    try {
      await doApproval();
      tracking.update('signing');     // Move to next step

      await doSign();
      tracking.update('supplying');

      await doSupply();
      tracking.complete();            // Removes from store, modal closes
      onSuccess?.();
    } catch (error) {
      tracking.fail();                // Removes from store
      throw error;
    }
  };

  return { execute, transaction: tracking.transaction };
}
```

**Key methods:**
- `start(steps, metadata, initialStep)` - Begin tracking, modal shows
- `update(stepId)` - Move to next step
- `complete()` / `fail()` - End tracking, remove from store
- `dismiss()` - Hide modal, tx continues in background (shows in indicator)

**No component-level ProcessModal needed.** `GlobalTransactionModals` (in layout) automatically renders modals for all visible transactions. When user dismisses, tx appears in `TransactionIndicator`. Clicking indicator restores the modal.

---

## 5. Styling Guidelines

### Rounding

- `rounded` - Modals, Cards, Tables, large containers
- `rounded-sm` - Buttons, Inputs, Tooltips, Tags

### Background

- `bg-surface` - First layer components
- `bg-hovered` - Hoverable elements or components on bg-surface

### Typography

- Avoid bold weights for emphasis
- Use `text-primary` / `text-secondary` for hierarchy
- Prefer `font-zen` for vault UI surfaces
