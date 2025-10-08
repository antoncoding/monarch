# Repository Guidelines

## Project Structure & Module Organization
Next.js routes live in `app/`. Shared logic sits in `src/` with UI in `src/components/`, hooks in `src/hooks/`. Keep constants inside `src/constants/`, configuration in `src/config/`, and reusable utilities in `src/utils/`. Static assets stay in `public/`; design primitives reside in `src/fonts/` and `src/imgs/`. Scripts that generate on-chain artifacts live under `scripts/`, and longer form references or RFCs belong in `docs/`.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies; stick with pnpm for lockfile parity.
- `pnpm dev` — start the hot-reloading Next.js dev server.
- `pnpm build` — create a clean production bundle after wiping `.next`.
- `pnpm start` — run the production build locally when validating releases.
- `pnpm check` — run formatting, ESLint, and Stylelint fixers as a bundle.
- `pnpm lint` / `pnpm stylelint` — target React or CSS changes without the full suite.

## Coding Style & Naming Conventions
Run `pnpm format` to apply the Prettier profile (100-char width, 2-space indent, single quotes, trailing commas, Tailwind-aware ordering). ESLint (Airbnb + Next.js) enforces hook safety and import hygiene; Stylelint keeps CSS utilities consistent. Use PascalCase for React components (`VaultBanner.tsx`), camelCase for helpers (`formatApr`), and SCREAMING_SNAKE_CASE for shared constants. Keep Tailwind classlists purposeful and lean; consolidate patterns with `tailwind-merge` helpers when they repeat.

## Styling Discipline
Consult `docs/Styling.md` before touching UI. Always follow the documented design tokens, Tailwind composition patterns, and variant rules—no exceptions. Mirror the examples in that guide for component structure, prop naming, and class ordering so the design system stays coherent. When using the shared `Spinner` component, pass numeric pixel values (e.g. `size={12}`)—it does not accept semantic strings.

## Implementation Mindset
Default to the simplest viable implementation first. Reach for straightforward data flows, avoid premature abstractions, and only layer on complexity when the trivial approach no longer meets requirements.

## Git Ownership
Never run git commits, pushes, or other history-altering commands—leave all git operations to the maintainers.

## Contract Interaction TL;DR
When writing new on-chain hooks, mirror the structure in `src/hooks/useERC20Approval.ts` and `src/hooks/useTransactionWithToast.tsx`: compute chain/address context up front, reuse `useTransactionWithToast` for consistent toast + confirmation handling, and expose a minimal hook surface (`{ action, isLoading }`) with refetch callbacks for follow-up reads.

## Commit & Pull Request Guidelines
Mirror the Conventional Commits style in history (`feat:`, `fix:`, `chore:`), keeping messages imperative and scoped. Sync with `main`, run `pnpm check`, and capture UI evidence (screenshots or short clips) for anything user-facing. Reference the relevant Linear/Jira ticket with closing keywords, call out risk areas, and flag required follow-ups. Tag reviewers who understand the touched protocol surfaces to speed feedback.

## Incident Log
- Autovault settings refactor: we unintentionally spammed the Morpho API because we passed fresh array literals (`defaultAllocatorAddresses`) into `useVaultV2Data`. That array was part of the hook’s memoised fetch dependencies, so every render produced a new reference, rebuilt the `useCallback`, and re-triggered the fetch effect. **Guardrail:** before handing arrays or objects to hooks that fire network requests, memoize the props (or pass a stable key) so React’s dependency checks only change when the underlying data truly changes.
