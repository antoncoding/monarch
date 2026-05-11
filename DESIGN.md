---
name: Monarch
description: Neutral, expert DeFi lending interface for direct Morpho control.
colors:
  monarch-orange: "#f45f2d"
  light-canvas: "#f0f2f7"
  light-surface: "#ffffff"
  light-hover: "#f6f8fb"
  text-ink: "#16181a"
  text-muted: "#8e8e8e"
  light-border: "#e2e8f0"
  dark-canvas: "#16181a"
  dark-surface: "#202426"
  dark-hover: "#313537"
  dark-border: "#1e293b"
  grid-muted-light: "#00000014"
  grid-muted-dark: "#ffffff14"
  grid-active: "#f45f2d99"
typography:
  display:
    fontFamily: "Zen Kaku Gothic New, Inter, sans-serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Zen Kaku Gothic New, Inter, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "Zen Kaku Gothic New, Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Victor Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.2em"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.monarch-orange}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-large:
    backgroundColor: "{colors.monarch-orange}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-default:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input-filled:
    backgroundColor: "{colors.light-hover}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  section-tag:
    textColor: "{colors.monarch-orange}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
---

# Design System: Monarch

## 1. Overview

**Creative North Star: "The Analyst's Workbench"**

Monarch is a restrained product interface for people who already understand that DeFi lending carries real tradeoffs. The current design works because it feels like a clean workbench: structured, data-forward, low-drama, and precise. Future work should preserve that character before adding any new visual idea.

The system uses light and dark technical neutrals, low-radius components, sparse Monarch Orange, dashed grid texture, and compact table-first layouts. It should feel useful to advanced DeFi users, Morpho power users, and fund managers who prefer control over persuasion.

It explicitly rejects the PRODUCT.md anti-references: a simple retail dashboard, hype-heavy crypto funnel, toy-like yield app, persuasive UX-maxi product, deposit-pressure patterns, exaggerated emotional copy, gamified yield chasing, and over-simplified risk presentation.

**Key Characteristics:**
- Dense enough for repeated market analysis, but clean enough to scan.
- Existing components are the default vocabulary; new surfaces should extend them, not replace them.
- Orange is reserved for primary action, selection, active state, and meaningful grid energy.
- Tables, filters, breadcrumbs, modals, and settings panels should remain familiar product UI.
- Landing-page grid accents may be expressive, but product surfaces stay neutral and task-first.

**The Preservation Rule.** Document the current design before changing it. Do not redesign Monarch by inventing a new theme, component library, or interaction language unless the task explicitly asks for that.

## 2. Colors

The palette is restrained technical neutral: warm light canvas, dark carbon canvas, white or near-black surfaces, gray secondary text, and Monarch Orange as the single high-chroma signal.

### Primary
- **Monarch Orange:** The only brand/action accent. Use it for primary buttons, current selections, active tab underlines, checked controls, focus rings, and sparse grid activation. Its strength comes from restraint.

### Neutral
- **Light Canvas:** The app background in light mode. It is slightly tinted and softer than pure white, which keeps dense tables from feeling sterile.
- **Light Surface:** The surface layer for cards, tables, headers, dropdowns, modals, and default buttons in light mode.
- **Light Hover:** The quiet hover and filled-field layer in light mode.
- **Text Ink:** Primary text in light mode and the visual anchor for data-heavy surfaces.
- **Text Muted:** Secondary labels, helper text, subdued metadata, and inactive affordances.
- **Light Border:** Low-contrast borders for table boundaries, cards, dropdowns, tabs, and inputs.
- **Dark Canvas:** The dark-mode background. It is a carbon neutral, not a black void.
- **Dark Surface:** The dark-mode surface layer for tables, cards, modals, and menus.
- **Dark Hover:** The dark-mode hover and pressed layer.
- **Dark Border:** Low-contrast dark-mode structural border.

### Texture
- **Grid Muted:** The dot and line grid texture in both themes. It should stay faint and structural.
- **Grid Active:** Orange grid activation used in landing accents and animated dividers. It is an accent rhythm, not a general background treatment.

### Named Rules

**The Orange Has Weight Rule.** Monarch Orange must stay rare. If a screen starts to look orange, the accent has failed.

**The Neutral Surface Rule.** Prefer background, surface, hover, border, and muted text tokens before adding new hues.

**The Grid Is Infrastructure Rule.** Dot grids and dashed borders should feel like measurement marks and table structure, not decoration pasted on top.

## 3. Typography

**Display Font:** Zen Kaku Gothic New, with Inter and sans-serif fallback.
**Body Font:** Inter, with sans-serif fallback.
**Label/Mono Font:** Victor Mono, with ui-monospace fallback.

**Character:** Zen gives Monarch a calm, precise product voice without becoming sterile. Inter carries dense body copy and table text. Victor Mono appears as a technical accent for tags, addresses, code-like labels, and section markers.

### Hierarchy
- **Display** (400, 3rem, 1.1 line-height): Landing headlines and major empty-state or intro messaging only.
- **Headline** (400, 2rem, 1.1 line-height): Page-level headings and major section titles.
- **Title** (500, 1rem, 1.25 line-height): Card titles, table group headers, filter labels, and compact panel titles.
- **Body** (400, 0.875rem, 1.5 line-height): Product copy, table support text, modal explanations, and standard interface text. Keep prose near 65 to 75 characters per line when it is explanatory.
- **Label** (400, 0.75rem, 0.2em letter spacing): Section tags, uppercase technical labels, and compact metadata. Use sparingly.

### Named Rules

**The Quiet Type Rule.** Do not create drama through type. Use weight, size, and spacing for hierarchy, not oversized labels or display type inside controls.

**The Mono Marker Rule.** Victor Mono is a signal for technical metadata and brackets, not a replacement body font.

## 4. Elevation

Monarch is flat at rest and layered through surface color, border, and compact spacing. Shadows exist, but they are quiet and mostly tied to controls, overlays, popovers, tooltips, cards, and hover states. In dark mode, ordinary shadows are intentionally suppressed and replaced with subtle white borders.

### Shadow Vocabulary
- **Surface Rest** (`shadow-sm`): Default tables, cards, compact filters, and neutral buttons.
- **Surface Hover** (`hover:shadow-md`): Button and action affordance feedback.
- **Overlay** (`shadow-md`, `shadow-lg`, `shadow-2xl`): Dropdowns, selects, tooltips, popovers, and modals.
- **Primary Selection Glow** (`0 2px 8px -2px color-mix(in srgb, currentColor 30%, transparent)`): Segmented controls and selected states where a small accent lift helps orientation.

### Named Rules

**The Flat At Rest Rule.** Surfaces should look stable before interaction. Add lift for state or overlay priority, not for decoration.

**The Dark Mode Border Rule.** In dark mode, low-contrast borders do more work than shadows. Preserve that choice.

## 5. Components

### Buttons

Buttons are compact, low-radius, and familiar. They should never look like marketing pills or retail conversion blocks.

- **Shape:** Gently squared corners, usually 6px, with 2px available for compact primitives.
- **Primary:** Monarch Orange background, light foreground, 40px height by default, 48px for large CTAs.
- **Default:** Surface background, primary text, subtle shadow, and brightness shift on hover.
- **Ghost:** Transparent by default, with a faint surface hover for icon and utility actions.
- **Hover / Focus:** 200ms transition, subtle brightness and shadow. Active state may scale to 0.98 for tactile confirmation.
- **Disabled / Loading:** Disabled controls lose opacity and pointer events. Loading buttons keep the same footprint and add the existing spinner.

### Chips

Chips and badges are small, information-dense markers.

- **Style:** 2px to 6px radius, small horizontal padding, 12px or 14px text.
- **State:** Default chips use gray or neutral fills. Primary and semantic badges use low-chroma tinted backgrounds.
- **Use:** Network markers, status labels, risk markers, and compact metadata only.

### Cards / Containers

Cards are working surfaces, not decorative marketing panels.

- **Corner Style:** Low-radius, usually 6px or 8px.
- **Background:** Surface layer in the current theme.
- **Shadow Strategy:** `shadow-sm` at rest, stronger shadows only when elevated as an overlay or focused interaction.
- **Border:** Low-contrast border for chart cards, feed sections, modals, and repeated panels.
- **Internal Padding:** 16px for compact panels, 24px for larger market or position headers.
- **Modal Scroll:** modal should let the main panel own vertical scrolling. Avoid nested scroll regions inside sections unless the content needs an independent fixed context.

### Inputs / Fields

Inputs are compact product controls with a filled or bordered surface.

- **Style:** 40px height, 2px radius for compact filters, 6px radius for standard inputs, 12px horizontal padding.
- **Focus:** Ring or border shifts to Monarch Orange at low opacity.
- **Error / Disabled:** Error uses red semantic color. Disabled states reduce opacity and retain layout.
- **Search:** Compact search inputs should keep the existing icon, clear action, and no extra explanation.

### Navigation

Navigation is a fixed top product bar with simple text links, dashed dividers, and active underline state.

- **Desktop:** Logo and Monarch wordmark at left, centered product routes, wallet and transaction controls at right.
- **Mobile:** Logo, dashed divider, menu trigger, and wallet action. Route lists move into the existing dropdown pattern.
- **Active State:** A thin Monarch Orange underline, not a background block.
- **More Menu:** Surface background, 2px radius, 12px padding, low border, shadow-lg overlay.

### Tables

Tables are the core product affordance and should stay dense, scannable, and structurally predictable.

- **Header:** Surface background, small muted labels, generous column padding.
- **Rows:** Surface background with hover layer. Existing table row hover and focused indicators are allowed as table-specific orientation signals.
- **Density:** Prefer compact controls and stable column widths over spacious card layouts.
- **Pagination / Settings:** Reuse existing compact surface controls and settings modal patterns.

### Modals

Modals are Radix-backed overlays for bounded, high-focus workflows.

- **Surface:** bg-surface, primary text, low-radius border, and high overlay shadow.
- **Backdrop:** Dark translucent backdrop with blur when focus isolation matters.
- **Size:** Use existing size map from small through full. Avoid custom sizing unless content genuinely requires it.
- **Dismissal:** Preserve existing dismissability rules for transaction and process flows.

### Landing Grid Accents

The landing page uses grid texture as a signature system element.

- **Section Tag:** Mono uppercase bracket tag, orange text, orange low-opacity border, 4px by 8px padding.
- **Grid Dividers:** Small square cells with muted base and sparse orange activation.
- **Halftone / Dot Grid:** Product imagery and texture should support the workbench feel. Do not turn the whole interface into a graphic poster.

## 6. Do's and Don'ts

### Do:
- **Do** preserve the current component library first: `button`, `card`, `input`, `table`, `dropdown-menu`, `select`, `tabs`, `modal`, and filter components are the default vocabulary.
- **Do** keep Monarch Orange sparse and meaningful: primary actions, active states, focus, checked state, and grid activation.
- **Do** keep product surfaces dense, neutral, and table-first for expert workflows.
- **Do** use low-radius controls, subtle borders, faint grid texture, and quiet shadows exactly because they make the interface feel precise.
- **Do** make risk, oracle, liquidity, collateral, and rate context visible without turning it into sales copy.
- **Do** respect reduced motion and keep motion tied to state, reveal, or feedback.

### Don't:
- **Don't** make Monarch feel like a simple retail dashboard.
- **Don't** make Monarch feel like a hype-heavy crypto funnel.
- **Don't** make Monarch feel like a toy-like yield app.
- **Don't** make Monarch feel like a persuasive UX-maxi product that nudges users into action before they are ready.
- **Don't** add deposit-pressure patterns, exaggerated emotional copy, gamified yield chasing, or over-simplified risk presentation.
- **Don't** replace the current visual system with a new theme, new radius scale, new typography system, or new component vocabulary during routine feature work.
- **Don't** use gradient text, decorative glassmorphism, hero-metric templates, identical marketing-card grids, or modal-first design as a default.
- **Don't** add heavy color to inactive states, especially full-saturation orange.
- **Don't** extend colored side-stripe accents beyond the existing table row orientation pattern.
