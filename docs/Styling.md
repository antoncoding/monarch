# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:

- `Button`: Import from `@/components/ui/button` for all clickable actions
- `Modal`: For **all** modal dialogs (always import from `@/components/common/Modal`)
- `Card`: For contained content sections

## Modal Guidelines

**IMPORTANT**: Always use our custom Modal components from `@/components/common/Modal`. The shared wrapper applies Monarch typography, corner radius, background, blur, and z-index rules automatically.

All modals MUST follow consistent styling standards for typography, spacing, and structure. There are two modal patterns based on use case.

### Modal Types

**1. Standard Modal** - For settings, management, and primary workflows
- Large settings modals (Trusted Vaults, Blacklisted Markets, Market Settings)
- Transaction modals (Rebalance, Market Selection)
- Onboarding and setup flows

**2. Compact Modal** - For filters, confirmations, and secondary dialogs
- Filter modals (Supply Asset Filter)
- Confirmation dialogs (Blacklist Confirmation)

### Using Our Modal Components

Import the primitives from our shared entry point (and nowhere else):

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
```

### Global Modal Context

Use `useGlobalModal` when you need a modal to persist independently of the component that triggers it:

```tsx
import { useGlobalModal } from '@/contexts/GlobalModalContext';

// In your component (e.g., inside a tooltip)
const { toggleModal, closeModal } = useGlobalModal();

<button onClick={() => toggleModal(<MyModal isOpen onClose={closeModal} />)}>
  <HelpIcon />
</button>
```

**When to use:**
- Modals triggered from tooltips (modal stays open when tooltip closes)
- Modals triggered from ephemeral UI that may unmount

**When NOT to use:**
- Standard page-level modals with local state
- Cases where parent component stays mounted

### Standard Modal Pattern

Use this pattern for primary workflows, settings, and management interfaces:

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  variant="standard"
  zIndex="settings"  // auto manages z-index layers
  size="xl"
>
  <ModalHeader
    title="Modal Title"
    description="Brief description of what this modal does"
  />

  <ModalBody>
    {/* Modal content - spacing and font-zen applied automatically */}
  </ModalBody>

  <ModalFooter>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="cta" onClick={handleConfirm}>Confirm</Button>
  </ModalFooter>
</Modal>
```

**With Icon Support:**

```tsx
import { TokenIcon } from '@/components/TokenIcon';

<Modal isOpen={isOpen} onClose={onClose} variant="standard" zIndex="base">
  <ModalHeader
    title={`Supply ${symbol}`}
    description="Supply to earn interest"
    icon={
      <TokenIcon
        address={tokenAddress}
        chainId={chainId}
        symbol={symbol}
        width={20}
        height={20}
      />
    }
  />
  <ModalBody>{/* content */}</ModalBody>
</Modal>
```

**With Actions in Header:**

```tsx
<ModalHeader
  title="Rebalance Position"
  description="Manage your positions"
  actions={
    <Button variant="light" size="sm" onClick={handleRefresh}>
      <RefreshIcon /> Refresh
    </Button>
  }
/>
```

**Auto-Applied Standards:**
- **Spacing**: Automatically applied based on variant (no extra padding needed)
- **Typography**: `font-zen` and text scales handled for you
- **Icon + actions slots**: Header provides `mainIcon`, `actions`, and an always-on close button
- **Z-Index**: Managed through named layers (base, process, selection, settings)
- **Backdrops**: Unified blur/opacity, so you get consistent overlays everywhere
- **Portal**: All modals render to `document.body` to avoid stacking bugs

### Compact Modal Pattern

Use this pattern for filters, confirmations, and quick actions:

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  variant="compact"
  zIndex="base"
  size="md"
>
  <ModalHeader
    variant="compact"
    title="Filter Options"
    description="Quick toggle filters"
  />

  <ModalBody variant="compact">
    {/* Modal content - tighter spacing applied automatically */}
  </ModalBody>

  <ModalFooter>
    <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
    <Button variant="cta" size="sm" onClick={handleApply}>Apply</Button>
  </ModalFooter>
</Modal>
```

**Auto-Applied Differences from Standard:**
- **Smaller padding**: `px-6 pt-4` vs `px-10 pt-6`
- **Smaller title**: `text-base` vs `text-lg`
- **Tighter spacing**: `gap-4` vs `gap-5`

### Z-Index Management

Our Modal component manages z-index automatically through named layers. This prevents conflicts when multiple modals are open:

```tsx
// Z-Index Layers (from lowest to highest):
zIndex="base"      // z-50   - Standard modals (Supply, Borrow, Campaign)
zIndex="process"   // z-1100 - Process/transaction modals
zIndex="selection" // z-2200 - Market/item selection modals
zIndex="settings"  // z-2300 - Settings modals (HIGHEST - always on top)
```

**Usage Example:**

```tsx
// Settings modal (should be on top of everything)
<Modal zIndex="settings">
  <ModalHeader title="Market Settings" />
  {/* ... */}
</Modal>

// Market selection modal (opened from settings)
<Modal zIndex="selection">
  <ModalHeader title="Select Market" />
  {/* ... */}
</Modal>

// Base modal (standard use case)
<Modal zIndex="base">
  <ModalHeader title="Supply USDC" />
  {/* ... */}
</Modal>
```


### Typography Rules

Typography is automatically handled by our Modal components. You don't need to specify font weights or sizes manually - just use the title/description props.

**IMPORTANT**: Never manually add bold or semibold font weights in modal headings/labels; rely on the shared components.

```tsx
// ✅ Correct - let the component handle typography
<ModalHeader title="Settings" description="Configure your preferences" />

// ❌ Incorrect - don't override with manual styles
<ModalHeader title={<span className="font-bold">Settings</span>} />
```

Use color and size to create hierarchy, not font weight:
- **Primary text**: `text-primary`
- **Secondary text**: `text-secondary`
- **Title size**: Automatically set based on variant
- **Description size**: Automatically set to `text-sm`

### Section Headers in Modal Body

For section headers within modal content, use consistent styling:

```tsx
// ✅ Correct
<h3 className="text-base font-normal text-primary">Section Title</h3>
```

### Custom Modals

For custom modals using `framer-motion`, apply `font-zen` to the outer container:

```tsx
// ✅ Correct - font-zen on the modal overlay
<div className="fixed inset-0 flex items-center justify-center bg-black/50 font-zen" style={{ zIndex: 50 }}>
  <div className="bg-surface relative w-full max-w-lg rounded p-6">
    {/* Modal content */}
  </div>
</div>

// With framer-motion
<AnimatePresence>
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-zen"
  >
    <motion.div className="relative w-full max-w-lg rounded bg-white p-4">
      {/* Modal content */}
    </motion.div>
  </motion.div>
</AnimatePresence>
```

## Component Guidelines

### Rounding

- Use `rounded` for:
  - Modals
  - Cards
  - Large content areas
  - Container components
  - Tables
  - Market info blocks
- Use `rounded-sm` for:
  - Buttons
  - Inputs
  - Filter components
  - Small interactive elements
  - Tooltips
  - Tags/badges
  - Helper text containers

### Button

Always use `Button` from `@/components/ui/button`.

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

Variants: `primary` | `surface` | `default` | `ghost`
Sizes: `xs` | `sm` | `md` | `lg` | `icon`

When wrapping Button in HeroUI Tooltip, wrap it in a `<span>` to prevent ResizeObserver errors.

### Switch

Always use `IconSwitch` from `@/components/ui/icon-switch`. Never use HeroUI Switch.

```tsx
import { IconSwitch } from '@/components/ui/icon-switch';

// Plain switch (no icon)
<IconSwitch
  size="xs"
  selected={isEnabled}
  onChange={setIsEnabled}
  thumbIcon={null}
/>

// With icon
function ViewIcon({ isSelected, className }: { isSelected?: boolean; className?: string }) {
  return isSelected ? <FiUser className={className} /> : <HiGlobe className={className} />;
}

<IconSwitch
  size="sm"
  selected={viewMode === 'user'}
  onChange={toggleView}
  thumbIcon={ViewIcon}
/>
```

Sizes: `xs` | `sm` | `md` | `lg`

### Checkbox

Always use `Checkbox` from `@/components/ui/checkbox`. Never use HeroUI Checkbox.

```tsx
import { Checkbox } from '@/components/ui/checkbox';

// Default
<Checkbox
  checked={isChecked}
  onCheckedChange={setIsChecked}
  label="Accept terms"
/>

// Highlighted
<Checkbox
  variant="highlighted"
  checked={isSelected}
  onCheckedChange={setIsSelected}
  label="Enable advanced features"
/>
```

Variants: `default` | `highlighted`

### Dropdown Menu

Always use `DropdownMenu` from `@/components/ui/dropdown-menu`.

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

// Basic
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleAction}>Action</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// With icons
<DropdownMenuItem startContent={<Icon />}>Supply</DropdownMenuItem>
<DropdownMenuItem endContent={<Icon />}>Explorer</DropdownMenuItem>

// Sections
<DropdownMenuSeparator />

// Multi-select
<DropdownMenuCheckboxItem
  checked={isChecked}
  onCheckedChange={setIsChecked}
>
  Item
</DropdownMenuCheckboxItem>

// Prevent auto-close (for switches)
<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
  {/* custom content */}
</DropdownMenuItem>
```

Alignment: `align="start"` | `"center"` | `"end"`

## Background, Border

- Use `bg-surface` first layer components
- Use `bg-hovered` for hoverable elements or components on "bg-surface"

## Tooltip

Always use `Tooltip` from `@/components/ui/tooltip`.

```tsx
import { Tooltip } from '@/components/ui/tooltip';

// Basic
<Tooltip content="This is a tooltip">
  <Button>Hover me</Button>
</Tooltip>

// With placement
<Tooltip content="Top tooltip" placement="top">
  <span>Hover me</span>
</Tooltip>

// With delays
<Tooltip content="Delayed tooltip" delay={500} closeDelay={200}>
  <InfoIcon />
</Tooltip>
```

**Props:** `content`, `placement` (`top` | `bottom` | `left` | `right`), `delay`, `closeDelay`, `className`, `classNames.content`

### Advanced with Primitives

```tsx
import { TooltipRoot, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

<TooltipRoot delayDuration={300}>
  <TooltipTrigger asChild>
    <button>Hover me</button>
  </TooltipTrigger>
  <TooltipContent side="right">
    <div className="flex flex-col gap-2">
      <p className="font-medium">Custom Content</p>
      <p className="text-xs text-secondary">Details</p>
    </div>
  </TooltipContent>
</TooltipRoot>
```

### Provider

```tsx
import { TooltipProvider } from '@/components/ui/tooltip';

<TooltipProvider>
  <App />
</TooltipProvider>
```

### Table Component

**Always use Table components from `@/components/ui/table`** - never use raw HTML `<table>` tags.

**Components:**
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/common/TablePagination';
```

**Basic Usage:**
```tsx
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

{/* Pagination - always use TablePagination */}
<TablePagination
  currentPage={page}
  totalPages={totalPages}
  totalEntries={items.length}
  pageSize={10}
  onPageChange={setPage}
  isLoading={loading}
/>
```

**Key Rules:**

1. **Variants**: Use `table-body-compact` on `<TableBody>` for activity/transaction tables (adds 6px cushion vs standard padding)
2. **Alignment**: Headers and cells must match - use `text-left`, `text-right`, or `text-center`
3. **Amount Columns**: Use flexbox with `justify-end` for right-aligned token icons, and use `text-sm` for text:
   ```tsx
   <TableCell>
     <div className="flex items-center justify-end gap-1 text-sm">
       <span>{amount}</span>
       <TokenIcon width={16} height={16} />
     </div>
   </TableCell>
   ```
4. **Pagination**: Always use `TablePagination` component (not HeroUI `Pagination`)

**Styling:** All styling applied via `app/global.css` - don't add inline styles or override padding.

### TablePagination Component

**TablePagination** (`@/components/common/TablePagination`)
- Unified pagination component for all tables in the app
- Provides consistent styling, smart page numbers with ellipsis, and jump-to-page functionality
- All text uses `font-zen !font-normal` (no bold styling)

**Features:**
- Smart page numbers with ellipsis for large page counts (shows 7 pages max)
- Jump-to-page search icon (appears when >10 pages)
- Optional entry count display ("Showing X-Y of Z entries")
- Loading states with disabled buttons
- Tighter spacing (gap-2) when used in layouts

**Props:**
- `currentPage`: Current active page (1-indexed)
- `totalPages`: Total number of pages
- `totalEntries`: Total number of items across all pages
- `pageSize`: Number of items per page
- `onPageChange`: Callback when page changes
- `isLoading?`: Show loading state (default: false)
- `showEntryCount?`: Display entry count below controls (default: true)

**Usage Examples:**

```tsx
import { TablePagination } from '@/components/common/TablePagination';

// Basic usage with entry count
<TablePagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalEntries={data.length}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  isLoading={isFetching}
/>

// Without entry count (e.g., main markets table)
<TablePagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalEntries={markets.length}
  pageSize={entriesPerPage}
  onPageChange={setCurrentPage}
  isLoading={false}
  showEntryCount={false}
/>

// In a table layout with tighter spacing
<div className="flex flex-col gap-2">
  <table className="responsive rounded-md font-zen">
    {/* table content */}
  </table>
  <TablePagination
    currentPage={page}
    totalPages={Math.ceil(total / size)}
    totalEntries={total}
    pageSize={size}
    onPageChange={setPage}
    isLoading={isLoading}
  />
</div>
```

### AccountIdentity

Use `AccountIdentity` from `@/components/common/AccountIdentity` for displaying addresses, ENS names, and vault names.

```tsx
import { AccountIdentity } from '@/components/common/AccountIdentity';

// Badge - minimal inline (no avatar)
<AccountIdentity address={address} variant="badge" />

// Compact - small avatar + text in badge
<AccountIdentity address={address} variant="compact" chainId={1} />

// Full - avatar + address badge + extra info badges
<AccountIdentity address={address} variant="full" showAddress />
```

Variants: `badge` | `compact` | `full`

Clicking opens actions popover (copy, view account, explorer). Disable with `showActions={false}`.

### MarketIdentity

Use `MarketIdentity` from `@/components/MarketIdentity` for displaying market info in tables, lists, and cards.

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

// Wide layout - for table cells
<MarketIdentity market={market} chainId={chainId} wide />
```

Modes: `Normal` | `Focused` | `Minimum`

### MarketDetailsBlock

Use `MarketDetailsBlock` from `@/components/common/MarketDetailsBlock` for expandable market details in modals.

```tsx
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';

<MarketDetailsBlock
  market={market}
  mode="supply"
  defaultCollapsed
  showRewards
/>
```

### TransactionIdentity

Use `TransactionIdentity` from `@/components/common/TransactionIdentity` for displaying transaction hashes.

```tsx
import { TransactionIdentity } from '@/components/common/TransactionIdentity';

<TransactionIdentity txHash={txHash} chainId={chainId} />
<TransactionIdentity txHash={txHash} chainId={chainId} showFullHash />
```

## Input Components

The codebase uses two different input approaches depending on the use case:

### Numerical Inputs (Amounts, Currency)

For numerical inputs with bigint values, decimals, and max validation, use the custom Input component:

```typescript
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

This component:

- Uses `bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none`
- Includes a "Max" button when `max` prop is provided
- Handles bigint conversion and decimal formatting
- Validates against maximum values

### Text Inputs (URLs, Strings)

For simple text inputs, use native HTML input with consistent styling:

```typescript
<input
  type="text"
  placeholder="Enter text..."
  value={inputValue}
  onChange={(e) => handleChange(e.target.value)}
  className="bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none"
/>
```

#### With Button Inside Input

```typescript
<div className="relative flex-grow">
  <input
    type="text"
    placeholder="Enter text..."
    value={inputValue}
    onChange={(e) => handleChange(e.target.value)}
    className="bg-hovered h-10 w-full rounded p-2 pr-16 focus:border-primary focus:outline-none"
  />
  <Button
    variant="cta"
    size="sm"
    onClick={handleAction}
    className="absolute right-1 top-1/2 -translate-y-1/2 transform"
  >
    Save
  </Button>
</div>
```

#### Error States

```typescript
className={`bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none ${
  error ? 'border border-red-500 focus:border-red-500' : ''
}`}

{error && (
  <p className="text-sm text-red-500">{error}</p>
)}
```

### Input Styling Guidelines

- Always use `bg-hovered` for background
- Standard height: `h-10`
- Always use `rounded` (not `rounded-sm`)
- Standard padding: `p-2`
- Focus state: `focus:border-primary focus:outline-none`
- Error state: `border border-red-500 focus:border-red-500`
- Error text: `text-sm text-red-500`

## Toast

Use `useStyledToast` hook to create toasts.

```typescript
import { useStyledToast } from '@/hooks/useStyledToast';

const { success, error } = useStyledToast();

success('Success', 'Detail of the success');
error('Error', 'Detail of the error');
```

### Typography Notes

- Avoid bold weights for emphasis. Use color, size, or layout treatments (e.g., `text-secondary`, `text-primary`, spacing) instead of `font-semibold`/`font-bold`.
- Prefer `font-zen` for vault UI surfaces; keep typography consistent with existing components.
