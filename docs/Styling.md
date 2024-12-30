# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:

- `Button`: Import from `@/components/common/Button` for all clickable actions
- `Modal`: For all modal dialogs
- `Card`: For contained content sections
- `Typography`: For text elements

## Component Guidelines

- Use `rounded` for tables, cards or bigger components
- Use `rounded-sm` for buttons, inputs

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
