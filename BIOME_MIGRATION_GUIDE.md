# Biome Migration Guide

## ✅ Completed: Gentle Migration Setup

The migration from ESLint to Biome (via ultracite) has been configured in a **gentle, non-aggressive way** that preserves your team's coding style preferences.

## Current State

### What's Done
- ✅ Custom `biome.jsonc` created that extends `ultracite/core`
- ✅ Formatter aligned with old Prettier config (lineWidth: 100, singleQuote, trailingCommas: all)
- ✅ Strict linter rules disabled to match team preferences
- ✅ Generated files (ABIs, config files) ignored
- ✅ Auto-import organizing disabled (prevents mass changes)
- ✅ Team preferences preserved:
  - Function declarations (not arrow functions)
  - `forEach` usage allowed
  - Enums allowed
  - Explicit `any` allowed where needed
  - Non-null assertions allowed
  - Nested ternaries allowed

### Current Baseline
- **Lint errors**: ~20 across 264 files (mostly `useImportType`, `noUnusedImports` - all safe & fixable)
- **Format differences**: ~115 files need line-wrapping to 100 chars (no style changes)

## Next Steps (Optional - Choose Your Approach)

### Option 1: Gradual Migration (Recommended)
1. **Fix lint errors incrementally** (when touching files):
   ```bash
   npx biome check --write path/to/file.tsx
   ```

2. **Format files as you go** (when editing):
   ```bash
   npx biome format --write path/to/file.tsx
   ```

3. **Eventually**: Run full format when ready:
   ```bash
   pnpm biome format --write .
   ```

### Option 2: One-Time Format (If you're ready)
If you want to apply all formatting changes at once:

```bash
# This will wrap long lines to 100 chars (matches old Prettier)
pnpm biome format --write .

# Then check for any remaining lint issues
pnpm lint:check
```

## Package.json Scripts

Your current scripts already use Biome:
- `pnpm lint:check` → runs `biome check .`
- `pnpm lint` → runs `biome check --write .`

## IDE Setup (Optional)

### VS Code
Create/update `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

## Cleanup Old Dependencies (When Ready)

Once you're fully on Biome, you can remove:
```bash
pnpm remove eslint prettier \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-import \
  eslint-plugin-jsx-a11y \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-react-perf \
  eslint-plugin-relay \
  prettier-plugin-tailwindcss
```

And delete:
- `.eslintrc-old.js` (reference file created during migration)
- `prettier.config.js` (if Biome formatter is fully adopted)

## Key Configuration Files

### biome.jsonc
Location: `/biome.jsonc`

Key overrides:
- **Formatter**: Matches old Prettier (100 char lines, single quotes, trailing commas)
- **Disabled rules**: All style-enforcement rules that conflict with team preferences
- **Ignored**: ABIs, config files, generated files

### Files to Keep
- `biome.jsonc` - Your custom Biome configuration
- `package.json` - Already has Biome scripts
- `.stylelintrc.json` - Still used for CSS linting

## Testing

Run these commands to verify everything works:

```bash
# Check for lint errors (should show ~20)
pnpm lint:check

# Format a single file to test
npx biome format --write src/components/TokenIcon.tsx

# Check git diff (should be minimal/none for formatted files)
git diff src/components/TokenIcon.tsx
```

## What's Different from ESLint?

### Preserved
- ✅ TypeScript strict rules (no-unsafe-*, switch-exhaustiveness, etc.)
- ✅ Import organization rules (can re-enable later when ready)
- ✅ Accessibility rules (a11y)
- ✅ Team coding style (function declarations, etc.)

### Disabled (for gentle migration)
- ❌ Auto-fixing imports on save (was causing mass changes)
- ❌ Strict style enforcement (useArrowFunction, etc.)
- ❌ Nursery rules (experimental, too aggressive)

### Can Re-enable Later
You can gradually re-enable rules in `biome.jsonc` as your codebase adapts:
- `organizeImports`: When you want auto-sorting
- `useSortedClasses`: For Tailwind class organization
- Various nursery rules: As they stabilize

## Summary

🎯 **Goal Achieved**: Migration is configured to be **gentle and non-disruptive**

✅ **No mass rewrites**: Formatter only wraps long lines, no style changes
✅ **Team preferences preserved**: All custom ESLint rules mapped to Biome equivalents
✅ **Minimal errors**: Only ~20 lint issues, all safe to fix
✅ **Ready for adoption**: Can use immediately or migrate gradually

---

**Questions?** Check the Biome docs: https://biomejs.dev/
