# Repository Guidelines

## Project Structure & Module Organization
Next.js routes live under `app/`. Shared logic and reusable UI sit in `src/`, with components in `src/components/`, hooks in `src/hooks/`, constants in `src/constants/`, and utilities in `src/utils/`. Smart-contract scripts and artifacts belong in `scripts/`; long-form docs live in `docs/`. Static assets stay in `public/`, while design primitives (fonts, illustrations) are grouped in `src/fonts/` and `src/imgs/`. Tests live alongside their subjects (`*.test.ts[x]`).

## Build, Test, and Development Commands
- `pnpm install` — install dependencies; pnpm is required for lockfile parity.
- `pnpm dev` — start the hot-reloading Next.js dev server.
- `pnpm build` — produce a clean production bundle after clearing `.next`.
- `pnpm start` — serve the production build locally for release validation.
- `pnpm check` — run formatting, ESLint, and Stylelint together.
- `pnpm lint` — target React or CSS changes individually.
- `pnpm test` — execute Jest suites with the configured setup.

## Coding Style & Naming Conventions
Run `pnpm format` (Prettier) before pushing: 2-space indentation, 100-character width, single quotes, and Tailwind-aware class ordering. ESLint (Airbnb + Next.js) enforces hook safety and import hygiene; Stylelint keeps utility ordering consistent. Use PascalCase for React components (`VaultBanner.tsx`), camelCase for helpers (`formatApr`), and SCREAMING_SNAKE_CASE for shared constants. Tailwind class lists should stay lean—dedupe variants with `tailwind-merge`. All toggles must use the shared `IconSwitch` (`@/components/common/IconSwitch`) for consistent sizing and animation.

## Testing Guidelines
Tests reside beside features (`*.test.ts`/`*.test.tsx`) and run via Jest. Prefer focused unit tests for utilities and integration-style specs for hooks/components that orchestrate protocol calls. Seed mocks through existing utilities; avoid duplicating fixtures. Run `pnpm test` locally and ensure suites pass before submitting. For protocol-critical flows (transactions, risk filters), add regression coverage mirroring real network scenarios.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`) in the imperative mood. Before opening a PR: rebase onto `main`, run `pnpm check`, and gather screenshots or clips for UI updates. Reference the relevant Linear/Jira issue with closing keywords, call out risk areas, and list follow-ups. Tag reviewers familiar with the touched protocol surface, and document manual validation steps (e.g., on-chain simulations).

## Security & Configuration Tips
When building on-chain hooks, mirror `useERC20Approval` and `useTransactionWithToast`—memoize arrays/objects before using them in effect dependencies to prevent redundant RPC calls. Never commit secrets; load configuration via `.env.local` and document required keys in `README.md`. Review `docs/Styling.md` before touching UI to stay aligned with Monarch design tokens and component patterns.
