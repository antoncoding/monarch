# Bundler Strategy (V2 + V3)

Last updated: February 27, 2026

## Goal

Keep stable V2 transaction paths for existing product behavior while introducing a separate V3 path only where swaps are required.

## Current Production Split

### Bundler V2 (active)

Use Bundler V2 for:

- Multi-supply and direct supply
- Borrow
- Repay
- Rebalance
- Existing deterministic leverage/deleverage flow (ERC4626-only route)

Implementation rule:

- Any V2 Morpho transaction path must use `src/hooks/useBundlerAuthorizationStep.ts`.

## Planned Bundler V3 Scope

Use Bundler V3 only for swap-dependent features:

- `rebalanceWithSwap`
- Generalized `useLeverage` route (any pair, not only ERC4626 deterministic route)

Do not migrate all legacy V2 hooks at once. Keep both tracks parallel so current users are not forced into new contract-approval risk.

## Bundler V3 Architecture Notes

Bundler V3 is adapter-driven and supports composing actions (including swaps) through dedicated adapter contracts and callbacks. This is structurally different from the narrower direct-action shape used in current V2 hooks.

For Monarch, this implies:

- Keep swap quote/execution logic isolated from V2 hooks.
- Introduce V3-specific builders/hooks instead of overloading existing V2 hooks.
- Add route guards for unsupported adapter paths and degrade gracefully.
- Reuse shared Velora API chokepoints from `src/features/swap/api/velora.ts` (quote + tx payload preparation) in future V3 bundler flows.

## Historical Approval Incident (April 2025)

Morpho published a security notice on April 10, 2025 regarding approvals to Bundler3 contracts. The guidance was to revoke approvals to affected Bundler3 addresses on specific networks.

Engineering implications:

- Never assume perpetual approvals are harmless for adapter-capable contracts.
- Default to explicit, minimal-privilege approvals and clear spender visibility in UI.
- Keep V3 rollout isolated and auditable before broadening to all transaction paths.

## Migration Sequence

1. Swap-first (now): use Velora quote + transaction payload execution in standalone swap flow.
2. Add V3 for swap-dependent product features only (`rebalanceWithSwap`, generalized leverage).
3. Keep V2 as default for non-swap flows until V3 parity and risk posture are validated.
