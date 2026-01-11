---
name: ui-components
description: Core component library and design system patterns. Use when building UI, building new components, new page, using design tokens, or working with the component library.
---

# Core Components


## Component Hierarchy

```
src/components/
├── ui/           # Design system primitives (Button, Badge, Spinner)
├── shared/       # Cross-feature, business-agnostic components
├── common/       # Common layout components (Modal, TableContainer)
├── layout/       # Layout wrappers (Header, Footer)
└── providers/    # Context providers
```


### Component Location Rules

```
src/components/ui/       → Pure UI primitives (Button, Badge, Table)
src/components/shared/   → Cross-feature components (TokenIcon, AccountIdentity)
src/features/{name}/     → Feature-specific components
src/modals/              → Global modals (multi-trigger)
```

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

## Styling Guidelines

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
