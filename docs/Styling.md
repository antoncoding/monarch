# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:

- `Button`: Import from `@/components/ui/button` for all clickable actions
- `Modal`: For **all** modal dialogs (always import from `@/components/common/Modal`)
- `Card`: For contained content sections

## Modal Guidelines

**IMPORTANT**: Always use our custom Modal components from `@/components/common/Modal`. Never import HeroUI modals directly. The shared wrapper applies Monarch typography, corner radius, background, blur, and z-index rules automatically.

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

// ❌ Incorrect
<h3 className="text-sm font-medium text-primary">Section Title</h3>
<h3 className="text-base font-semibold text-primary">Section Title</h3>
```

### Custom Modals (Non-HeroUI)

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

### Button Component

```typescript
import { Button } from '@/components/ui/button';
```

#### Button Variants

Our button system uses 4 simple, purpose-driven variants:

**default** - For buttons on background areas
- Uses `bg-surface` color
- Hover: Darkens slightly and increases opacity
- Use for: Navigation buttons, actions on main background
- Example: "Back to Markets", top-level page actions

**primary** - For important actions
- Uses `bg-primary` color (primary theme color, NOT orange)
- Hover: Increases shadow and opacity, slight scale down on click
- Use for: Main CTAs, confirmations, primary flows
- Example: "New Position", "Execute Rebalance", "Supply", "Withdraw"

**surface** - For buttons on surface-colored backgrounds
- Uses `bg-hovered` color - Subtle, doesn't stand out too much
- Hover: `bg-default-200`, Active: `bg-default-300` (gentle color progression)
- Use for: Actions in cards, modals, table rows
- Example: "Claim" button in tables, dropdown triggers, actions in cards

**ghost** - For icon buttons and minimal actions
- Transparent background with responsive hover states
- Icon buttons: Scale up slightly on hover, visible background feedback
- Size-specific hover styles for optimal feedback
- Use for: Icon-only buttons, utility actions, settings
- Example: Refresh icons, settings icons, filter toggles

#### Examples

```tsx
// Primary - Important action
<Button variant="primary" size="md" className="font-zen">
  New Position
</Button>

// Surface - Action in a table/card (subtle)
<Button variant="surface" size="sm">
  Claim
</Button>

// Default - Navigation on background
<Button variant="default" size="md">
  <ChevronLeftIcon className="mr-2" />
  Back to Markets
</Button>

// Ghost - Icon-only button with tooltip (always wrap in span for HeroUI Tooltip)
<Tooltip
  classNames={{
    base: 'p-0 m-0 bg-transparent shadow-sm border-none',
    content: 'p-0 m-0 bg-transparent shadow-sm border-none',
  }}
  content={<TooltipContent title="Refresh" detail="Fetch latest data" />}
>
  <span>
    <Button variant="ghost" size="icon" className="text-secondary">
      <RefreshIcon />
    </Button>
  </span>
</Tooltip>
```

#### Button Sizes

- `xs`: Extra small (h-6, 40px min-width) - Rare use
- `sm`: Small (h-8, 64px min-width) - Common for compact actions
- `md`/`default`: Medium (h-10, 80px min-width) - Standard size
- `lg`: Large (h-12, 96px min-width) - Important CTAs
- `icon`: Icon-only (h-8 w-8, 14px icons) - Use for icon buttons

#### Button Hover Effects

All buttons have subtle hover refinements:
- **Opacity**: Buttons start at 95% opacity and become 100% on hover for a refined look
- **Color transitions**: Smooth 200ms transitions for all state changes
- **Scale feedback**: Active state provides tactile press feedback
- **Ghost buttons**: Size-specific hover behaviors for optimal UX
  - Icon size: Scales to 105% on hover, darker background
  - Small size: Scales to 102% on hover, medium background
  - Medium/Large: Scales to 101% on hover, lighter background

**Important Note**: When wrapping Button in HeroUI Tooltip, always wrap the Button in a `<span>` to prevent ResizeObserver errors.

### Toggle Controls

- Always use the shared `IconSwitch` component (`@/components/common/IconSwitch`) for boolean toggles so dimensions, motion, and iconography stay consistent across pages.
- Prefer the `xs` size inside dense settings groups (e.g., Market Settings, global Settings). Pair the switch with a left-aligned label and secondary description beneath it to mirror existing sections.
- Example:

```tsx
import { IconSwitch } from '@/components/common/IconSwitch';

<div className="flex items-start justify-between gap-4">
  <div className="flex flex-col gap-1">
    <h4 className="text-base font-medium text-primary">Show Unknown Tokens</h4>
    <p className="text-xs text-secondary">Display assets flagged as unverified.</p>
  </div>
  <IconSwitch
    size="xs"
    color="primary"
    selected={value}
    onChange={setValue}
    aria-label="Toggle unknown tokens"
  />
</div>
```

## Background, Border

- Use `bg-surface` first layer components
- Use `bg-hovered` for hoverable elements or components on "bg-surface"

## Tooltip

Use the `TooltipContent` component for consistent tooltip styling. The component supports two modes:

### Simple Tooltip (no detail)
Shows icon, title, and optional action link on the right:

```tsx
<Tooltip
  classNames={{
    base: 'p-0 m-0 bg-transparent shadow-sm border-none',
    content: 'p-0 m-0 bg-transparent shadow-sm border-none',
  }}
  content={<TooltipContent icon={<GrStatusGood />} title="Tooltip Title" />}
>
  {/* Your trigger element */}
</Tooltip>
```

### Complex Tooltip (with detail)
Shows icon, title, detail text, and optional secondary detail text:

```tsx
<Tooltip
  classNames={{
    base: 'p-0 m-0 bg-transparent shadow-sm border-none',
    content: 'p-0 m-0 bg-transparent shadow-sm border-none',
  }}
  content={
    <TooltipContent
      icon={<GrStatusGood />}
      title="Tooltip Title"
      detail="Main description (text-primary, text-sm)"
      secondaryDetail="Additional info (text-secondary, text-xs)"
    />
  }
>
  {/* Your trigger element */}
</Tooltip>
```

### Tooltip with Action Link
Add an action link (like explorer) in the top-right corner:

```tsx
<TooltipContent
  icon={icon}
  title="Token Name"
  detail="Main description"
  secondaryDetail="Source or additional info"
  actionIcon={<FiExternalLink className="h-4 w-4" />}
  actionHref="https://explorer.com/address/0x123"
  onActionClick={(e) => e.stopPropagation()}
/>
```

**Important:**
- Always use the `classNames` configuration shown above to remove HeroUI's default styling
- `detail`: Main description text (text-primary, text-sm)
- `secondaryDetail`: Additional info below detail (text-secondary, text-xs)

## Shared UI Elements

- Render token avatars with `TokenIcon` (`@/components/TokenIcon`) so chain-specific fallbacks, glyph sizing, and tooltips stay consistent.
- Display oracle provenance data with `OracleVendorBadge` (`@/components/OracleVendorBadge`) instead of plain text to benefit from vendor icons, warnings, and tooltips.

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
- Rounded-md styling with bg-surface
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

**Styling Notes:**
- Uses `font-zen !font-normal` throughout (overrides button's default font-medium)
- All buttons have consistent 8px height (h-8)
- Rounded-md container with bg-surface and shadow-sm
- Primary color for active page button
- Jump-to-page popover with Input and Go button
- Entry count uses text-xs text-secondary

### Account Identity Component

**AccountIdentity** (`@/components/common/AccountIdentity`)
- Unified component for displaying addresses, vault names, and ENS names
- Three variants: `badge`, `compact`, `full`
- All avatars are round by default

**Variant Behaviors:**

**Badge** - Minimal inline (no avatar)
- Shows: Vault name → ENS name → Shortened address

**Compact** - Avatar (16px) wrapped in badge
- Avatar + (Vault name → ENS name → Shortened address)
- Single badge wraps both avatar and text

**Full** - Horizontal layout with all info
- Avatar (36px) + Address badge + Extra badges (all on one line, centered)
- **Address badge**: Always shows shortened address (e.g., 0x1234...5678), click to copy
- **Extra badges** (shown based on conditions):
  - Connected badge (if wallet is connected)
  - ENS badge (if `showAddress=true` and no vault name)
  - Vault badge (if address is a known vault)

**Styling Rules:**
- Use `rounded-sm` for badges (not `rounded`)
- Background: `bg-hovered` (or `bg-green-500/10` for connected)
- Text: `font-zen` with `text-secondary` or `text-primary`
- No underscores in variable names
- All avatars are round
- Full variant: all elements centered vertically
- Smooth Framer Motion animations on all interactions

```tsx
import { AccountIdentity } from '@/components/common/AccountIdentity';

// Badge variant - minimal inline (no avatar)
<AccountIdentity
  address={address}
  variant="badge"
  linkTo="profile"
  showCopy
/>

// Compact variant - avatar (16px) wrapped in badge background
<AccountIdentity
  address={address}
  variant="compact"
  linkTo="explorer"
  chainId={1}
/>

// Full variant - avatar + address + extra info badges
<AccountIdentity
  address={address}
  variant="full"
  showAddress  // Shows ENS badge if available
/>

// Full variant for vault address
<AccountIdentity
  address={vaultAddress}
  variant="full"
  chainId={1}  // Will show vault name badge if recognized
/>
```

**Props:**
- `variant`: `'badge'` | `'compact'` | `'full'`
- `linkTo`: `'explorer'` | `'profile'` | `'none'`
- `showCopy`: Show copy icon at end of badge
- `copyable`: Make entire component clickable to copy
- `showAddress`: Show ENS badge (full variant only)
- `showActions`: Show actions popover on click (default: `true`)

**Actions Popover (Default Behavior):**

By default, clicking any AccountIdentity shows a minimal popover with:
1. **Copy Address** - Copies address to clipboard
2. **View Account** - Navigate to positions page
3. **View on Explorer** - Opens Etherscan in new tab

To disable: `showActions={false}`

```tsx
// Default - shows actions popover on click
<AccountIdentity address={address} variant="badge" />

// Disable actions (e.g., in dropdown menus)
<AccountIdentity address={address} variant="badge" showActions={false} />
```

### Market Display Components

Use the right component for displaying market information:

**MarketIdentity** (`@/components/MarketIdentity`)
- Use for displaying market info in compact rows (tables, lists, cards)
- Shows token icons, symbols, LLTV badge, and oracle badge
- Three modes: `Normal`, `Focused`, `Minimum`
- Focus parameter: `Loan` or `Collateral` (affects which symbol is emphasized)

```tsx
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';

// Focused mode (default) - emphasizes one asset
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Focused}
  focus={MarketIdentityFocus.Collateral}
  showLltv={true}
  showOracle={true}
  iconSize={20}
  showExplorerLink={true}
/>

// Normal mode - both assets shown equally
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Normal}
/>

// Minimum mode - only shows the focused asset (with LLTV and oracle if enabled)
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Minimum}
  focus={MarketIdentityFocus.Collateral}
  showLltv={true}
  showOracle={true}
/>

// Wide layout - spreads content across full width (useful for tables)
// Icon + name on left, LLTV in middle, oracle on right
<MarketIdentity
  market={market}
  chainId={chainId}
  mode={MarketIdentityMode.Minimum}
  focus={MarketIdentityFocus.Collateral}
  showLltv={true}
  showOracle={true}
  wide={true}
/>
```

**Wide Layout:**

The `wide` prop changes the layout to use `justify-between` with full width, perfect for table cells:

- **Left side**: Token icon(s) + symbol(s)
- **Middle**: LLTV badge (if enabled)
- **Right side**: Oracle badge (if enabled)

Works with all three modes (Normal, Focused, Minimum). Use in table cells with a fixed width for consistent alignment:

```tsx
<td style={{ width: '280px' }}>
  <MarketIdentity
    market={market}
    chainId={chainId}
    mode={MarketIdentityMode.Minimum}
    focus={MarketIdentityFocus.Collateral}
    showLltv={true}
    showOracle={true}
    wide={true}
  />
</td>
```

**MarketDetailsBlock** (`@/components/common/MarketDetailsBlock`)
- Used for previewing transactions onto a existing market.
- Use as an expandable row in modals (e.g., supply/borrow flows)
- Shows market state details when expanded (APY, liquidity, utilization, etc.)
- Includes collapse/expand functionality

```tsx
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';

<MarketDetailsBlock
  market={market}
  mode="supply"
  showDetailsLink={true}
  defaultCollapsed={false}
  showRewards={true}
/>
```

**When to use which:**
- Tables/Lists/Cards, Data display → Use `MarketIdentity`
- Modal flows during a transaction, with expandable details → Use `MarketDetailsBlock`

**TransactionIdentity** (`@/components/common/TransactionIdentity`)
- Use to display transaction hashes with explorer links
- Consistent monospace badge styling with external link icon
- Supports full or truncated hash display
- Always opens in new tab with security attributes

```tsx
import { TransactionIdentity } from '@/components/common/TransactionIdentity';

// Standard usage (truncated hash)
<TransactionIdentity
  txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  chainId={1}
/>

// Full hash display
<TransactionIdentity
  txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  chainId={1}
  showFullHash={true}
/>

// With custom styling
<TransactionIdentity
  txHash={txHash}
  chainId={chainId}
  className="ml-2"
/>
```

**Styling:**
- Uses `font-monospace text-[0.65rem]` for hash display
- Badge with `bg-hovered rounded-sm px-2 py-1`
- Hover: `hover:bg-gray-300 hover:text-primary dark:hover:bg-gray-700`
- External link icon (3x3) aligned with text
- Click event stops propagation to prevent row/parent click handlers

**MarketIdBadge** (`@/components/MarketIdBadge`)
- Use to display a short market ID badge with optional network icon and warning indicator
- Consistent styling across all tables
- `chainId` is required
- Warning indicator reserves space for alignment even when no warnings present

```tsx
import { MarketIdBadge } from '@/components/MarketIdBadge';

// Basic usage (required chainId)
<MarketIdBadge marketId={market.uniqueKey} chainId={chainId} />

// With network icon and warnings
<MarketIdBadge
  chainId={market.morphoBlue.chain.id}
  showNetworkIcon={true}
  showWarnings={true}
  market={market}
/>

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
