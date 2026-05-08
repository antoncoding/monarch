# Agent Guidelines

Universal coding-agent rules for the Monarch codebase.

## Operating Contract

- Anchor work on the user-critical failure or requested outcome.
- Prefer the smallest chokepoint change that preserves existing behavior.
- Do not claim repo facts without evidence from files, commands, or docs.
- Reuse existing utilities, feature boundaries, and project patterns before adding new ones.
- Keep diffs small, reviewable, and reversible.
- Do not add production dependencies unless the user explicitly asks.

## Required Project Context

- Consult `docs/TECHNICAL_OVERVIEW.md` when architecture, data flow, state management, or domain behavior matters.
- Load the relevant project skill before domain-specific work when that skill is available:
  - `icons` for icon decisions.
  - `transaction-hooks` for EVM contracts, signing, permits, and transaction tracking.
  - `ui-components` for UI components, design tokens, modals, and tables.
  - `data-and-state-management` for React Query, Zustand, persistence, and data fetching.
  - `feature-structure` for new features, pages, or file organization.

## Implementation Rules

- Reproduce and understand bugs before fixing them.
- Preserve existing functionality; a fix that removes required behavior is a regression.
- Prefer first-principles domain fixes over retries, filters, or workaround logic.
- Remove temporary debugging code before finishing.
- Run `npx ultracite fix` before committing, and `npx ultracite check` to verify, when code changes make those checks relevant.
- Try to see if you can fix the issue by removing complexity. Always question whether all lines of code are necessary and remove unnecessary experiments.

## Final Validation Gate
For every non-trivial code or docs change, do this immediately before the final response:

1. Read `docs/VALIDATIONS.md`.
2. Apply only the sections relevant to the files and behavior touched.
3. Fix validation failures before reporting completion, unless blocked.
4. In the final response, state the validation sections and rules applied, verification run, and remaining risks.

When a user-reported bug exposes a reusable failure pattern, add the new rule to `docs/VALIDATIONS.md`, not this file.
