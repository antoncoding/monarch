# Repository Guidelines

## Project Structure & Module Organization
Next.js routes live under `app/`. Shared logic and reusable UI sit in `src/`, with components in `src/components/`, hooks in `src/hooks/`, constants in `src/constants/`, and utilities in `src/utils/`. Contract artifacts and scripts belong in `scripts/`, long-form docs in `docs/`, and static assets (images, fonts, icons) in `public/`, `src/imgs/`, and `src/fonts/` respectively. Defensive storage keys, network helpers, and protocol-specific types also live in `src/utils/`—reuse them rather than duplicating shapes.

## Build, Test, and Development Commands
- `pnpm install` — install workspace dependencies (pnpm is required for lockfile parity).
- `pnpm dev` — start the hot-reloading Next.js dev server.
- `pnpm build` — create a fresh production bundle after wiping `.next`.
- `pnpm start` — serve the production build locally for release validation.
- `pnpm check` — run formatters, ESLint, and Stylelint as one task.
- `pnpm lint` / `pnpm stylelint` — target React or CSS changes individually.
- `pnpm test` — execute Jest suites with the shared setup.

## Coding Style & Naming Conventions
Run `pnpm format` (Prettier) before pushing: 2-space indentation, 100-char width, single quotes, and Tailwind-aware class ordering. ESLint (Airbnb + Next.js) guards hook safety, dependency arrays, and import hygiene; Stylelint enforces utility ordering. Use PascalCase for React components (`VaultBanner.tsx`), camelCase for helpers (`formatApr`), and SCREAMING_SNAKE_CASE for shared constants. Tailwind classlists should stay lean—coalesce variants with `tailwind-merge` utilities. All boolean toggles must use the shared `IconSwitch` (`@/components/common/IconSwitch`) for consistent spacing and animation.

## Testing Guidelines
Tests live beside their subjects (`*.test.ts`/`*.test.tsx`) and use Jest with the custom environment defined in `jest.setup.ts`. Prefer focused unit specs for utilities and integration-style tests for hooks/components that orchestrate on-chain data. Run `pnpm test` locally and ensure suites pass before submitting. When modifying protocol-critical flows (transactions, risk filters), add regression coverage to mirror real network states.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) in imperative present tense. Before opening a PR: rebase onto `main`, run `pnpm check`, and gather screenshots or clips for any UI-visible change. Reference the related Linear/Jira issue with closing keywords, call out risk areas or migrations, and list required follow-ups. Tag reviewers familiar with the affected protocol or contract surface to speed feedback, and note any manual verification steps (e.g., on-chain simulations).

## Security & Configuration Tips
When writing on-chain hooks, mirror `useERC20Approval` and `useTransactionWithToast`—memoize inputs before passing them into effects to avoid network thrashing. Never embed secrets: load configuration from `.env.local` and document required keys in `README.md`. Before adjusting UI layout, review `docs/Styling.md` to stay aligned with Monarch design tokens and component patterns.
