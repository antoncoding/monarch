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
<Button variant="ghost" size="sm">
  <RefreshIcon className="mr-2" />
  Refresh
</Button>
```

## Background, Border

- Use `bg-surface` first layer components
- Use `bg-hovered` for hoverable elements or components on "bg-surface"

## Tooltip

Use the nextui tooltip with <TooltipContent> component for consistnet styling

```
<Tooltip
  className="rounded-sm" // for consistent styling
  content={<TooltipContent
    icon={<GrStatusGood />}
    title="Tooltip Title"
    detail="Tooltip Detail"
  />}

>
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
