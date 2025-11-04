# Repository Guidelines

## Project Structure & Module Organization
Next.js routes live in `app/`. Shared logic sits under `src/`, with reusable UI in `src/components/`, hooks in `src/hooks/`, constants in `src/constants/`, and utilities in `src/utils/`. Static assets belong in `public/`, while design primitives are grouped under `src/fonts/` and `src/imgs/`. Scripts for on-chain artifacts reside in `scripts/`, and longer form references collect in `docs/`.

## Build, Test, and Development Commands
- `pnpm install` — install workspace dependencies; always prefer pnpm to preserve the lockfile.
- `pnpm dev` — launch the hot-reloading Next.js dev server.
- `pnpm build` — produce a clean production bundle (wipes `.next`).
- `pnpm start` — run the production build locally for release checks.
- `pnpm check` — run formatting, ESLint, and Stylelint fixers together.
- `pnpm lint` / `pnpm stylelint` — target React or CSS surfaces individually.

## Coding Style & Naming Conventions
Prettier enforces a 100-char width, 2-space indent, single quotes, and Tailwind-aware class ordering (`pnpm format`). ESLint (Airbnb + Next.js) guards hook safety and import hygiene; Stylelint ensures consistent utility usage. Use PascalCase for React components (e.g., `VaultBanner.tsx`), camelCase for helpers (e.g., `formatApr`), and SCREAMING_SNAKE_CASE for shared constants. Keep Tailwind classlists lean, merging variants with `tailwind-merge` where possible.

## Testing Guidelines
Reuse existing hooks/components in `src/hooks/` and `src/components/` to keep logic testable. Integration tests live alongside features; unit helpers belong near their modules. Mirror existing test naming (`*.test.ts`/`*.test.tsx`). Run `pnpm test` for suites and ensure coverage does not regress before submitting a PR.

## Commit & Pull Request Guidelines
Adopt Conventional Commits (`feat:`, `fix:`, `chore:`) in imperative form. Before opening a PR, sync with `main`, run `pnpm check`, and attach UI evidence (screenshots or clips) for user-facing work. Reference the relevant Linear/Jira ticket with closing keywords, call out risky areas, and list follow-ups. Tag reviewers familiar with the touched protocol surface for faster feedback.

## Security & Configuration Tips
When creating new on-chain hooks, follow the structure in `src/hooks/useERC20Approval.ts` and `src/hooks/useTransactionWithToast.tsx`. Memoize array/object dependencies before passing them into hooks that trigger network requests to avoid repeat fetches. Never commit keys or secrets; prefer environment variables loaded via `.env.local`.
