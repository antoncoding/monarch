# Validation Rules

Use this file at the end of non-trivial work. Do not front-load it at task start unless the task is specifically about validation rules.

## How To Apply

1. Identify what changed: behavior, data flow, UI, transactions, persistence, docs, tests, or tooling.
2. Read the sections below that match the changed surface.
3. Check the change against the relevant rules from first principles.
4. Run the narrowest commands that prove the change is correct.
5. Report applied sections, commands run, and remaining risks in the final response.


## Universal Validation

- The change solves the user-critical failure or requested outcome.
- The fix is at the smallest stable chokepoint, not scattered across feature-local workarounds.
- Existing behavior is preserved unless the user explicitly requested a behavior change.
- The implementation uses established UI components, util functions, and project patterns where possible. Do not declare ad hoc functions, always try to expand existing utilities or shared components first.
- The final code remains accessible, performant, type-safe, and maintainable.
- There are comments explaining "why" we do certain thing when a function is complex, or a workflow is updated and non-obvious.
- After updating a function, check all appearances of that function across the codebase to ensure the change doesn't introduce new bugs.
- Try to see if this change introduce too many lines of code. Always question are all lines of code necessary? Can we achieve the same goal with fewer lines of code or more elegantly by solving the issue at a higher level / different checkpoint?

## Bug Fixes

- Reproduce or otherwise ground the failure before changing behavior.
- Prefer root-cause fixes over retries, filtering, smaller batches, silent ignores, or fallback-only masking.
- If you had multiple tries to fix the bug, remove the failed attempts and any temporary debugging code before reporting completion.

## Consolidation Pass

- Remove duplicated logic across files, especially repeated UI blocks and repeated data-shaping code.
- Prefer one container-level or shared chokepoint constraint over per-component truncation or ad hoc guards.
- Re-check the domain model so the behavior applies consistently to all valid entities, not only one vendor, chain, asset, or page.
- Delete transitional code that was useful during debugging but increases long-term complexity.
- Keep ABI definitions, RPC/indexer/query hooks, domain matching, unit conversion, formatting, and large UI sections in established shared or feature chokepoints.

## React And TypeScript

- Use function components and keep hooks at the top level.
- Do not define components inside other components. 
- Make sure bad no `useEffect` causing infinite looping.
- Use stable, unique keys for iterables instead of array indexes when an entity ID exists.
- Reuse existing explicit types. Do not use `any` 
- Use type narrowing instead of type assertions when practical.
- Use meaningful constants instead of magic numbers.
- Use `const` by default, use `for...of` loops over `.forEach()` and indexed loops.
- Avoid spread syntax in accumulators inside loops.
- Use top-level regex literals instead of creating regexes repeatedly in loops.

## Async And Errors

- Await promises in async functions when their result or failure matters.
- Prefer `async`/`await` over promise chains.
- Handle errors at a meaningful boundary. Do not catch just to rethrow.
- Throw `Error` objects with descriptive messages.

## State Persistence

- Do not use `window.localStorage` directly. If direct storage access is unavoidable, isolate it in one shared utility or store layer and document why.
- Use `useAppSettings` or an existing dedicated persisted Zustand store when it fits the state.
- Validate SSR/client boundaries when persistence touches browser-only APIs.

## Data And Domain Flows

- Data fetching should use existing React Query hooks and established cache keys where possible.
- Please respect the setting in "useCustomRPC" whenever a request is RPC related.
- Grouped fetching via RPC must be bundled with `multicall` to increase efficiency if they're on the same chain or block.
- Domain matching, token resolution, unit conversion, address normalization, and formatting should live in shared chokepoints.
- Multi-chain logic must respect chain ID and address together; do not match by address alone across chains.
- Fallback data should be marked or shaped consistently with primary data so downstream components can reason about it safely.
- Portfolio and position analysis must preserve transaction-discovered market IDs even when current on-chain balances are zero; list-level hide settings must not remove those markets from summary or history inputs.


## Transactions And Wallet Flows

- Any flow that sends Morpho actions through Bundler V2 must pass through `useBundlerAuthorizationStep`.
- Preserve the distinction between signature mode and transaction mode for approvals.
- Do not introduce duplicate Sentry capture for `sendTransaction` mutation errors; `useTransactionWithToast` already reports send failures.
- Use shared logic hooks like useBundlerAuthorizationStep, useTransactionWithToast, useTransactionProcessStore...etc. Look at a similar hook and try to follow the pattern instead of creating from scratch.
- Validate chain IDs, token addresses, and allowance/permit assumptions at the transaction boundary.
- Make sure chain switching and wallet connection are handled. Use shared component like `ExecuteTransactionButton`.


## UI And Accessibility

- Avoid repeated large UI blocks; extract or reuse only when it reduces real duplication.
- Validate loading, empty, disabled, error, and success states for changed flows.
- Do not use Next.js raw image patterns where the project expects `next/image`.
- Make sure Mobile view is considered.
- Simplify wording to have clear call to action, remove unnecessary explain to details. Focus on what a user should do and should see, not what you want to say

## Verification Commands

Choose the narrowest useful set:

- `npx ultracite fix` after code edits when formatting/lint auto-fixes are relevant.
- `npx ultracite check` after code edits to verify formatting and lint.
- Typecheck/build/test commands that cover the changed surface.

If a relevant command cannot be run, state why and identify the residual risk.

## Final Response Checklist

- State the files changed.
- State the validation sections applied.
- State the verification commands run and whether they passed.
- State remaining risks or say none known.
- Is it the most elegant way to solve the problem? If not, go back and provide your feedback again to iterate on the solution.
- For user-reported bugs in high-impact flows, also state:
  - root cause category,
  - why prior validation missed it,
  - which new validation rule now prevents recurrence.
