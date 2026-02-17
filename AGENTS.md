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

## First-Principles Self-Review (Before Proposing Fixes)

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

**STOP after each implementation step and validate before moving on.** This is NOT optional. Do NOT batch all validation to the end.

After each step, ask out loud:
1. Are all changes necessary? Could this be done more simply?
2. Did I introduce unused props, duplicated logic, or unnecessary complexity?
3. Do the changes follow accessibility, performance, type safety, and maintainability principles?
4. Did I zoom out to check the change in context of surrounding code?

Running `tsc` and lint is NOT validation — those are mechanical checks. Validation means **thinking from first principles** about whether the code is correct, simple, and necessary.

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
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

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
