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

1. **Canonical identity matching**: use canonical IDs/addresses (see `src/types/token.ts`), never symbol/name for logic or route matching.
2. **Shared math/conversion helpers only**: reuse `src/hooks/leverage/math.ts`, `src/utils/repay-estimation.ts`, `src/hooks/useRepayTransaction.ts`, and `src/modals/borrow/components/helpers.ts` (`computeLtv`) instead of ad hoc formulas.
3. **Computation-backed previews**: previews must be built from real oracle/quote/conversion paths and match tx-builder inputs.
4. **Stepper/state-machine correctness**: first step must match runtime auth/signature state, and step order must never go backwards.
5. **Post-transaction state hygiene**: on success reset draft inputs and trigger required refetches without loops/unbounded re-renders.
6. **Display formatting discipline**: use shared formatting utilities from `src/hooks/leverage/math.ts` (`formatCompactTokenAmount`, `formatFullTokenAmount`, `formatTokenAmountPreview`) and existing readable-amount helpers consistently (`src/utils/token-amount-format.ts` is a re-export layer).
7. **UI clarity and duplication checks**: remove duplicate/redundant/low-signal data and keep only decision-critical information.
8. **Null/data-corruption resilience**: guard null/undefined/stale API/contract fields so malformed data fails gracefully.
9. **Runtime guards on optional config/routes**: avoid unsafe non-null assertions in tx-critical paths; unsupported routes/config must degrade gracefully.
10. **Bundler authorization and transfer-authority chokepoint**: every Morpho bundler transaction path (supply, borrow, repay, rebalance, leverage/deleverage) must route through `useBundlerAuthorizationStep` rather than implementing ad hoc authorization logic per hook; Permit2/ERC20 spender scope must target the contract that actually pulls the token (never Bundler3 unless it is the transfer executor), readiness must fail closed, and auth helpers must preserve original wallet/chain errors.
11. **Locale-safe decimal inputs**: transaction-critical amount/slippage inputs must accept both `,` and `.`, preserve transient edit states (e.g. `''`, `.`) during typing, and only normalize/clamp on commit (`blur`/submit) so delete-and-retype flows never lock users into stale values.
12. **Aggregator API contract integrity**: quote-only request params must never be forwarded to transaction-build endpoints (e.g. Velora `version` on `/prices` but not `/transactions/:network`); enforce endpoint-specific payload/query builders, normalize fetch/network failures into typed API errors, and verify returned route token addresses match requested canonical token addresses before using previews/tx payloads.
13. **User-rejection error normalization**: transaction hooks must map wallet rejection payloads (EIP-1193 `4001`, `ACTION_REJECTED`, viem request-argument dumps) to a short canonical UI message (`User rejected transaction.`) and never render raw payload text in inline UI/error boxes.
14. **Input/state integrity in tx-critical UIs**: never strip unsupported numeric syntax into a different value (e.g. `1e-6` must be rejected, not rewritten), and after any balance refetch re-derive selected token objects from refreshed data before allowing `Max`/submit.
15. **Bundler3 swap route integrity**: Bundler3 swap leverage/deleverage must use adapter flashloan callbacks (not pre-swap borrow gating), with `callbackHash`/`reenter` wiring and adapter token flows matching on-chain contracts; before submit, verify aggregator quote/tx parity (trusted target, exact/min calldata offsets, and same-pair combined-sell normalization) so previewed borrow/repay/collateral amounts cannot drift from executed inputs; prefer exact-in close executors that fully consume the withdrawn collateral over max-sell refund paths that can strand shared-adapter balances, and only relax build-time allowance checks for adapter-executed paths when the failure is allowance-specific.
16. **Quote, preview, and route-state integrity**: when a preview depends on one or more aggregator legs, surface failures from every required leg and use conservative fallbacks (`0`, disable submit) instead of optimistic defaults, but optional exact-close quote legs must not block still-valid partial execution paths; if a close-out path depends on a dedicated debt-close bound (for example BUY/max-close quoting) plus a separate execution preview, full-close / repay-by-shares intent must be driven by one explicit close-route flag shared by preview and tx building, the close executor must be satisfiable under the same slippage floor shown in UI, and if the current sell quote can fully close debt while the exact close bound is still unresolved the UI must fail closed rather than silently degrading to a dust-leaving partial path; for exact-in swap deleverage routes, the exact close bound is a threshold for switching into close mode, not a universal input cap, so valid oversell/refund paths must remain available and previews must continue to match the selected exact-in amount; preview rate/slippage must come from the executable quote/config, selected route mode must never execute a different route while capability probes are in-flight, and route controls/entry CTAs must stay consistent with capability probes without duplicate low-signal UI.

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
