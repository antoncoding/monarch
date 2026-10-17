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

## How Pendle Routing Works

The Pendle API supplies a proposed route, but it does not decide which contracts Monarch trusts.

| Value | Source | Check before execution |
|---|---|---|
| Bundler3, GeneralAdapter1, ParaswapAdapter | Morpho's chain address registry | Must exactly match the canonical addresses for the selected chain |
| Pendle Router (`0x888888888889758F76e7103c6CbF23ABbF58F946`) | Hardcoded canonical address | The API's `tx.to` must equal this address |
| Pendle Limit Router (`0x000000000000c9B3E2C3Ec88B1B4c0cD853f4321`) | Hardcoded canonical address | Calldata may use either no limit router or this address |
| Pendle market | Decoded from the API calldata | Its PT/SY/YT are read onchain; its factory must be allowlisted and must recognize the market |
| PT, SY, YT, expiry, and yield factory | Read onchain starting from the collateral PT | The yield factory must be allowlisted and must recognize the PT/YT pair |
| Supported SY input/output tokens | Read from `SY.getTokensIn()` and `SY.getTokensOut()` | The encoded Pendle input/output must be one of the verified tokens |
| Amounts and swap calldata | Pendle `/v3/sdk/{chainId}/convert` API | Re-decode and verify receiver, tokens, exact input, minimum output, slippage, and limit orders |

`enableAggregator` is disabled in the Pendle request. If the loan token is not the chosen SY token, Velora/ParaSwap only performs the loan-token ↔ SY-token leg. The canonical Pendle Router performs the SY-token ↔ PT leg.

Leverage runs as:

1. Transfer wallet funds to GeneralAdapter1.
2. Optionally swap loan token to an accepted SY input through ParaswapAdapter.
3. Transfer that SY input to Bundler3, approve the canonical Pendle Router, and buy PT.
4. Supply the PT as Morpho collateral.
5. Flash loan the debt leg and repeat conversion → supply → borrow inside the callback.

Deleverage reverses the flow: flash loan → repay → withdraw PT → sell/redeem PT through Pendle → optionally swap the SY output to the loan token → repay the flash loan. After maturity, Pendle redemption replaces the market swap.

Pendle leverage charges 0.0075% of added collateral, capped at $10 when a valid collateral USD price is available. Pendle deleverage has no Monarch fee.

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
