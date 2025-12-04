# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:

- `Button`: Import from `@/components/common/Button` for all clickable actions
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
import { Button } from '@/components/common/Button';
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
    <Button variant="secondary" onPress={onClose}>Cancel</Button>
    <Button variant="cta" onPress={handleConfirm}>Confirm</Button>
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
    <Button variant="light" size="sm" onPress={handleRefresh}>
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
    <Button variant="secondary" size="sm" onPress={onClose}>Cancel</Button>
    <Button variant="cta" size="sm" onPress={handleApply}>Apply</Button>
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
