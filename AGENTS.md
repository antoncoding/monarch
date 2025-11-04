# Repository Guidelines

## Project Structure & Module Organization
Next.js routes live in `app/`. Shared logic sits under `src/`, with UI components in `src/components/`, hooks in `src/hooks/`, constants in `src/constants/`, and reusable utilities in `src/utils/`. Static assets belong in `public/`; design primitives reside in `src/fonts/` and `src/imgs/`. Scripts for on-chain workflows live under `scripts/`, and long-form references collect in `docs/`.

## Build, Test, and Development Commands
- `pnpm install` — install workspace dependencies; stick with pnpm for lockfile parity.
- `pnpm dev` — start the Next.js dev server with hot reloading.
- `pnpm build` — produce a production bundle after clearing `.next`.
- `pnpm start` — serve the production build locally for release validation.
- `pnpm check` — execute formatting, ESLint, and Stylelint in one pass.
- `pnpm lint` / `pnpm stylelint` — target React or CSS surfaces individually.

## Coding Style & Naming Conventions
Prettier enforces 2-space indentation, 100-char width, single quotes, and Tailwind-aware class ordering (`pnpm format`). ESLint (Airbnb + Next.js) enforces hook safety and import hygiene; Stylelint keeps Tailwind utilities consistent. Use PascalCase for React components (e.g., `VaultBanner.tsx`), camelCase for helpers (`formatApr`), and SCREAMING_SNAKE_CASE for shared constants. Keep Tailwind classlists minimal; dedupe with `tailwind-merge` utilities.

## Testing Guidelines
Integration and unit tests sit near their features. Follow the existing naming pattern (`*.test.ts[x]`). Use the existing Jest setup via `pnpm test`. When touching protocol-critical paths, add targeted cases; ensure no coverage regressions before submitting a PR.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`) in the imperative mood. Before opening a PR: sync with `main`, run `pnpm check`, and attach screenshots or clips for UI changes. Reference the relevant Linear/Jira ticket with closing keywords, highlight risk areas, call out follow-up work, and tag reviewers familiar with the touched protocol surfaces.

## Security & Configuration Tips
When adding on-chain hooks, mirror patterns in `src/hooks/useERC20Approval.ts` and `src/hooks/useTransactionWithToast.tsx`; memoize objects/arrays before wiring them into effect dependencies to prevent API thrashing. Never commit secrets—load configuration through `.env.local` instead. Review `docs/Styling.md` before altering UI surfaces to stay aligned with the design system.
