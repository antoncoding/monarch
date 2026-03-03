# Agent Guidelines

Universal coding agent rules for Ultracite codebase. Applies to Claude, Codex, Claude Code, and similar agents.

---

## 📚 Documentation References

Always consult these docs for detailed information:

- **@docs/TECHNICAL_OVERVIEW.md** - Architecture, data flow, tech stack, state management
- **Skills** - Domain-specific patterns (see below)

---

## Core Philosophy

1. Anchor on the user-critical failure before proposing solutions.
2. Prefer the smallest chokepoint change over broad instrumentation.
3. Avoid scope creep unless it is required to solve the root cause.
4. Do not claim repo facts without evidence (no invented counts).
5. Prevent double-capture, noisy heuristics, or duplicate logic.

## Post-Implementation Consolidation (Mandatory)

Before closing any non-trivial change:

1. Run one consolidation pass and remove duplicated logic across files (especially repeated UI blocks).
2. Prefer one chokepoint fix for layout constraints (container-level width/spacing) over per-component ad hoc truncation.
3. Re-check first principles against the domain model so behavior applies consistently to all valid entities (not vendor-specific shortcuts).
4. Remove transitional code that was useful during debugging but adds long-term complexity.

---

## 🛠️ Skills System

This project uses **skills** for domain-specific patterns. Agents should load the relevant skill before working on related tasks.

### Available Skills

| Skill | When to Use |
|-------|-------------|
| `icons` | Adding, modifying, or choosing icons |
| `transaction-hooks` | EVM contracts, signing transactions, permit, transaction tracking |
| `ui-components` | Building UI, components, design tokens, modals, tables |
| `data-and-state-management` | Data fetching, React Query, Zustand stores, user preferences |
| `feature-structure` | Creating new features, pages, file organization |

### How to Use Skills

When starting a task that matches a skill, load it using the `skill` tool:

```
skill(name: "ui-components")    → For UI work
skill(name: "icons")            → For icon decisions
skill(name: "transaction-hooks")→ For blockchain transactions
skill(name: "data-and-state-management") → For data/state patterns
skill(name: "feature-structure")→ For new features/pages
```

The skill injects detailed patterns and conventions into the conversation context.

---

## 🐛 Bug Fixing - From First Principles

**MUST AVOID — quick-fix traps:**

1. **Don't jump to workarounds** — Retry logic, reducing batch sizes, adding filters... these mask problems, not solve them
2. **Don't sacrifice features for a "fix"** — If your fix breaks/removes functionality, it's not a fix
3. **Don't propose solutions before understanding the cause** — "Let's just ignore this error" without knowing WHY it happens is lazy
4. **Don't assume — verify** — If you claim something about the response/behavior, capture actual data and prove it

**The approach:**

1. **Reproduce reliably first** — Get a minimal case that triggers the bug consistently (or understand the intermittent pattern)
2. **Isolate the trigger** — Binary search: remove half the variables, see if bug persists. Repeat until you find the exact cause
3. **Capture real responses** — Don't guess what the API/system returns. Log it. Inspect it. Base conclusions on actual data
4. **Understand WHY before proposing HOW** — Root cause first, solution second. The fix should address the cause, not mask symptoms
5. **Preserve existing functionality** — If your fix removes features or changes behavior elsewhere, it's a regression, not a fix

**When stuck on intermittent bugs:**
- Run the same request multiple times, log each response
- Diff successful vs failed responses
- Look for patterns: timing, specific data, field combinations
- Ask: "What's different about the failing cases?"

---

## Self-Review (Before Proposing Fixes)

Before proposing a solution, add a short self-review:

1. What user-critical failure are we solving?
2. Is the change scoped to the smallest chokepoint that fixes the root cause?
3. Does it avoid scope creep (new features) unless required to solve the root cause?
4. What evidence in the repo supports the claim? (no invented counts)
5. What is the simplest safe rollout path?
6. What would we NOT do to keep the change auditable and safe?
7. What could cause double-capture, noise, or duplicate logic?

If you cannot answer these briefly, do not propose the change yet.

---

## Plan Gate (Scope Check)

If the proposed work touches more than 2 files, adds a new module, or changes runtime behavior, provide a short plan first and wait for confirmation.

Plan format:
1. Goal
2. Smallest viable change
3. Files touched
4. Risk/rollback note

---

## MANDATORY: Validate After Every Implementation Step

> **CRITICAL GATE**
> STOP after each implementation step and validate before moving on.
> This is NOT optional. Do NOT batch all validation to the end.

After each step, ask out loud:
1. Are all changes necessary? Could this be done more simply?
2. Did I introduce unused props, duplicated logic, or unnecessary complexity?
3. Do the changes follow accessibility, performance, type safety, and maintainability principles?
4. Did I zoom out to check the change in context of surrounding code?

Running `tsc` and lint is NOT validation — those are mechanical checks. Validation means **thinking from first principles** about whether the code is correct, simple, and necessary.

### REQUIRED: High-Impact Flow Validation

When touching transaction and position flows, validation MUST include all relevant checks below (not just the changed line):

1. **Canonical identity matching**: use canonical IDs/addresses for logic, routing, and comparisons; never use symbol/name as identity.
2. **Shared domain helpers only**: use shared math, conversion, and transaction helpers; avoid ad hoc formulas duplicated inside UI/hooks.
3. **Rate display consistency**: use shared APY/APR display primitives (for example `src/components/shared/rate-formatted.tsx`, `src/features/positions/components/preview/apy-preview.tsx`, and shared rate-label logic) instead of per-component conversion/label logic.
4. **Post-action rate preview parity**: transaction modals that change position yield/rates must show current -> projected post-action APY/APR, and preview mode (APR vs APY) must match the global setting used by execution summaries.
5. **Bigint unit discipline**: keep on-chain amounts as `bigint` for all calculations; only convert at boundaries with `parseUnits` (input) and `formatUnits` or shared token-amount formatters (display/serialization).
6. **Computation-backed previews**: risk, rate, and amount previews must come from executable quote/oracle/conversion inputs and match tx-builder inputs.
7. **Historical rate weighting integrity**: grouped/portfolio realized APY/APR must be weighted by capital-time exposure (for example average capital × exposure time), never by simple averages or balance-only weights that ignore holding duration.
8. **Transaction tracking progress integrity**: use `useTransactionTracking` as the progress-bar/stepper chokepoint, define explicit ordered steps per flow, and call `tracking.update(...)` only when advancing to a strictly later step (never backwards or out of order).
9. **Post-transaction state hygiene**: on success, reset transient draft state and trigger required refetches with bounded/reactive dependencies (no loops or stale closures).
10. **Input integrity**: support locale-safe decimal entry, preserve transient typing states, reject unsupported numeric syntax explicitly, and normalize only at commit boundaries.
11. **API contract integrity**: keep endpoint-specific request builders strict, normalize remote errors into typed app errors, and verify response token/route identities before using previews or tx payloads.
12. **Authorization/allowance chokepoints**: route spender/permit/authorization logic through shared chokepoints; fail closed when readiness or config is missing.
13. **Null/stale-data resilience**: guard null/undefined/stale API and contract fields in all tx-critical paths so malformed data degrades safely.
14. **Preview stability under refresh**: while quotes/routes refetch, keep last settled preview state (or neutral loading state), not transient placeholder values.
15. **Transaction-history consistency**: dedupe and merge confirmed local/on-chain history consistently (canonical user+chain scope, stable dedup key, bounded TTL) to avoid double counting during indexer lag.
16. **Share-based full-exit withdrawals**: when an existing supplied position is intended to be fully exited (or the target leaves only dust), prefer share-based `morphoWithdraw` over asset-amount withdrawal so residual dust is not stranded by rounding.
17. **UI signal quality**: remove duplicate or low-signal metrics and keep transaction-critical UI focused on decision-relevant data.
18. **External incentive parity**: when external rewards (for example Merkl HOLD opportunities) materially change carry economics, include them in net preview calculations when global reward-inclusion is enabled, and resolve incentives using canonical chainId+address mappings rather than token symbols.
### REQUIRED: Regression Rule Capture

After fixing any user-reported bug in a high-impact flow:

1. Add or update at least one validation bullet in this document if the bug exposed a new failure pattern.
2. State explicitly in the final response:
   - root cause category,
   - why prior validation missed it,
   - which new validation rule now prevents recurrence.
3. Prefer chokepoint validations that protect all related components, not just the touched file.

---

## Code Quality Standards

**Formatting & Linting:**
- Run `npx ultracite fix` before committing
- Run `npx ultracite check` to verify

**Core Principles:**
- Write code that is **accessible, performant, type-safe, and maintainable**
- Focus on clarity and explicit intent over brevity

### Type Safety & Explicitness
- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript
- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises
- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains
- Handle errors appropriately with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX
- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility

### Error Handling & Debugging
- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Performance
- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

---

## When Biome/Ultracite Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
