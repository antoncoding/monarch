# Bundler Strategy (V2 + V3)

Last updated: October 17, 2026

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

## Bundler V3 Scope

Use Bundler V3 only for swap-dependent features:

- `rebalanceWithSwap`
- Generalized leverage/deleverage routes, including Pendle PT collateral

Do not migrate all legacy V2 hooks at once. Keep both tracks parallel so current users are not forced into new contract-approval risk.

Morpho now deprecates Bundler3 for new standard integrations, but its replacement Bundles do not yet cover DEX swaps or leverage. Keep this path isolated and do not expand its approval surface.

## Bundler V3 Architecture Notes

Bundler V3 is adapter-driven and supports composing actions (including swaps) through dedicated adapter contracts and callbacks. This is structurally different from the narrower direct-action shape used in current V2 hooks.

For Monarch, this implies:

- Keep swap quote/execution logic isolated from V2 hooks.
- Introduce V3-specific builders/hooks instead of overloading existing V2 hooks.
- Add route guards for unsupported adapter paths and degrade gracefully.
- Reuse shared Velora API chokepoints from `src/features/swap/api/velora.ts` (quote + tx payload preparation) in V3 bundler flows.
- Treat Pendle as a separate verified execution leg: Velora may convert the loan token to the Pendle SY input token, but the Paraswap adapter never executes Pendle calldata.
- For leverage, convert and supply wallet capital before the flash loan, then repeat conversion → supply → borrow inside the callback; this mirrors the reviewed Yieldz transaction phases.
- If the Pendle SY accepts the loan token directly, fall back to that route when Velora is unavailable; use the same direct-output fallback during deleverage.
- Allow only canonical Pendle Router, Limit Router, market factories, and yield-contract factories; reject nested Pendle aggregators; and verify PT/SY/YT/market relationships onchain before building the bundle.
- Validate locally computed slippage and Morpho share-price bounds in addition to API-provided limits, and support the canonical post-expiry `redeemPyToToken` unwind path.
- Build and validate the complete external call graph before asking for persistent token approvals or Morpho authorization.

## Historical Approval Incident (April 2025)

Morpho published a security notice on April 10, 2025 regarding approvals to Bundler3 contracts. The guidance was to revoke approvals to affected Bundler3 addresses on specific networks.

Engineering implications:

- Never assume perpetual approvals are harmless for adapter-capable contracts.
- Default to explicit, minimal-privilege approvals and clear spender visibility in UI.
- Keep V3 rollout isolated and auditable before broadening to all transaction paths.

## Migration Sequence

1. Swap-first: use Velora quote + transaction payload execution in the standalone swap flow.
2. Use V3 for generalized leverage/deleverage, with dedicated route validation for composed protocols such as Pendle.
3. Add V3 to `rebalanceWithSwap` when that product path is implemented.
4. Keep V2 as default for non-swap flows until V3 parity and risk posture are validated.
