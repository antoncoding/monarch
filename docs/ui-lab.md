# UI Lab

A dev-only component playground for fast UI iteration with deterministic fixture data.

## Run

```bash
pnpm dev:ui-lab
```

UI Lab routes:

- `http://localhost:3000/ui-lab/button`
- `http://localhost:3000/ui-lab/tooltip`
- `http://localhost:3000/ui-lab/tooltip-content`
- `http://localhost:3000/ui-lab/network-filter`
- `http://localhost:3000/ui-lab/asset-filter`
- `http://localhost:3000/ui-lab/account-identity`
- `http://localhost:3000/ui-lab/market-identity`
- `http://localhost:3000/ui-lab/market-details-block`
- `http://localhost:3000/ui-lab/dropdown-menu`
- `http://localhost:3000/ui-lab/table-pagination`
- `http://localhost:3000/ui-lab/borrow-modal`
- `http://localhost:3000/ui-lab/market-selection-modal`
- `http://localhost:3000/ui-lab/supply-modal`

The route is gated by `NEXT_PUBLIC_ENABLE_UI_LAB=true`.

## URL state

- Component selection is stored in the path segment (`/ui-lab/<id>`).
- Canvas controls are stored in query params:
  - `pad`
  - `maxW`
  - `bg`

Share the full URL to keep the same component and canvas setup.

## Add a new component

1. Add fixture data if needed in `src/features/ui-lab/fixtures`.
2. Add a harness in `src/features/ui-lab/harnesses`.
3. Register an entry in `src/features/ui-lab/registry.tsx`.
4. Open `/ui-lab/<entry-id>` and verify it renders.

## Notes

- The global `DataPrefetcher` is skipped on `/ui-lab` to avoid background market/oracle/reward fetches while iterating.
- Complex modals are rendered through harness wrappers with fixture props so layout work stays deterministic.
- Shared realistic fixtures live in:
  - `src/features/ui-lab/fixtures/market-fixtures.ts`
  - `src/features/ui-lab/fixtures/component-fixtures.ts`
