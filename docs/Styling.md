# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:

- `Button`: Import from `@/components/common/Button` for all clickable actions
- `Modal`: For all modal dialogs
- `Card`: For contained content sections

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
import { Button } from '@/components/common/Button';
```

#### Button Variants

- `default`: Standard surface-colored button

  - Use for: Navigation buttons, "Back", "Cancel" actions
  - Example: "Back to Markets", "Cancel"

- `cta`: Primary call-to-action with orange background

  - Use for: Main actions, confirmations, primary flows
  - Example: "Launch App", "Execute Rebalance", "Start Lending"

- `interactive`: Subtle background with strong hover effect (background → primary)

  - Use for: Table row actions, interactive elements
  - Example: "Claim", "Supply", "Withdraw" in tables

- `secondary`: Subtle background (hovered color) without hover transform

  - Use for: Secondary actions, less prominent options
  - Example: "Remove" in tables, "Cancel" in modals

- `ghost`: Most subtle variant with minimal visual impact
  - Use for: Tertiary actions, subtle navigation
  - Example: "Refresh" buttons, utility actions

#### Examples

```tsx
// Primary CTA
<Button variant="cta" size="lg" className="font-zen">
  Launch App
</Button>

// Table Action
<Button variant="interactive" size="sm">
  Claim
</Button>

// Navigation
<Button variant="default" size="md">
  <ChevronLeftIcon className="mr-2" />
  Back to Markets
</Button>

// Secondary Action
<Button variant="secondary" size="md">
  Cancel
</Button>

// Utility Action
<Button variant="subtle" size="sm">
  <RefreshIcon className="mr-2" />
  Refresh
</Button>
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
- Tables/Lists/Cards → Use `MarketIdentity`
- Modal flows with expandable details → Use `MarketDetailsBlock`

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
    onPress={handleAction}
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
