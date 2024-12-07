# Styling and CSS Guidelines

## Core Components

Use these shared components instead of raw HTML elements:
- `Button`: For all clickable actions
- `Modal`: For all modal dialogs
- `Card`: For contained content sections
- `Typography`: For text elements

## Colors
- Background: `bg-main`
- Surface elements (cards, buttons): `bg-surface`
- Text:
  - Primary: `text-primary`
  - Secondary: `text-secondary`

## Spacing System
- `space-xs`: 0.5rem (8px)
- `space-sm`: 1rem (16px)
- `space-md`: 1.5rem (24px)
- `space-lg`: 2rem (32px)
- `space-xl`: 3rem (48px)

## Typography
- Font Sizes:
  - `text-xs`: 0.75rem (12px)
  - `text-sm`: 0.875rem (14px)
  - `text-base`: 1rem (16px)
  - `text-lg`: 1.125rem (18px)
  - `text-xl`: 1.25rem (20px)
- Font Weights:
  - Normal: 400 (`font-normal`)
  - Medium: 500 (`font-medium`)
  - Semibold: 600 (`font-semibold`)
  - Bold: 700 (`font-bold`)

## Rounded Corners
- Small: `rounded-sm`
- Base: `rounded-base`

## Shadows
- Light: `shadow-sm`
- Base: `shadow-base`
- Heavy: `shadow-lg`

## Layout
- Use `PageContainer` for consistent page layout
- Use `Section` for consistent vertical spacing
- Maximum content width: `max-w-7xl`
- Standard padding: `px-4 sm:px-6 lg:px-8`

## Component Guidelines
1. Buttons:
   - Use `rounded-base` for consistency
   - Include hover and active states
   - Maintain consistent padding: `px-4 py-2`

2. Modals:
   - Always use `rounded-lg`
   - Standard padding: `p-6`
   - Consistent max-width: `max-w-lg`

3. Cards:
   - Use `rounded-base`
   - Consistent padding: `p-4`
   - Standard shadow: `shadow-base`
