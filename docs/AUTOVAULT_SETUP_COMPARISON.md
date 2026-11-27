# Autovault setup comparison

Verified on 2026-09-10 against Base RPC history and the JavaScript served by [Morpho's curator app](https://curator.morpho.org/vaults/create).

## Live reference

[SoSoValue x Unified Labs USDC](https://base.blockscout.com/address/0xb88A0269C0b7E665F15DE46F634e02cE81E361c9) uses Base USDC, with 6 underlying decimals.

| Step | Block | Transaction |
| --- | --- | --- |
| Create Vault V2 | 51,024,757 | [Deployment](https://base.blockscout.com/tx/0xad3ab8ea7eb2c03ab93f9a86669565b85663009fef27494c304ac7a0b9dc1213) |
| Set name, symbol, curator | 51,024,762 | [Identity](https://base.blockscout.com/tx/0x746595c500322ff60d2be9450138ac5602ec96d6a0f5ff07f696875f38e65197) |
| Approve USDC | 51,024,780 | [Approval](https://base.blockscout.com/tx/0x00c1656b83a861414b7fc12b75283aa5c329e897c7f203394a8e23352fd12a79) |
| Apply permanent settings and mint dead shares | 51,024,785 | [Setup and seed](https://base.blockscout.com/tx/0x44f3bb2993073d512996126aa1bddc33eb532e234459f8ff3b1c6227d99c23f8) |
| Register adapter | 51,024,800 | [Adapter](https://base.blockscout.com/tx/0xb9b273a843249c0ada7174b1deeca6108f7751767d424331f19fc30ae6b75125) |

The successful setup transaction contains 11 vault calls: submit/execute the registry setting; submit/execute abdication of the registry setter and three exit-critical gate setters; then `mint(1000000000000000000, 0x000000000000000000000000000000000000dEaD)`.

Historical reads at block 51,024,784 returned zero supply, zero assets, and zero for all three exit gates. Vault logs from deployment through setup contain no earlier deposit. At block 51,024,785, supply and dead-address balance both equal `1e18`; assets and `convertToAssets(1e18)` both equal `1e6`. The seed therefore spent exactly **1 USDC** and was the first deposit. Deployment preceded the seed by 56 seconds.

The approval transaction granted 9 USDC, leaving 8 after seeding. The current curator builder requests only the calculated seed amount when allowance is insufficient; this particular wallet's larger approval is an observed transaction choice, not the builder's default.

## Current curator implementation

The served [share calculator](https://curator.morpho.org/_next/static/immutable/chunks/1mcrmyw5p2eh3.js) matches Monarch's share and asset amounts for every integer decimal value from 0 through 255. It follows [Morpho's published formula](https://docs.morpho.org/curate/tutorials-v2/dead-deposit/).

The served [creation and permanent-settings builders](https://curator.morpho.org/_next/static/immutable/chunks/1_icf6v3uc7lz.js) separate deployment, identity, and permanent settings. The latter clears any nonzero exit gates before abdication and minting. Approval can be batched with permanent settings on supported wallets; deployment has a separate confirmation wait.

Executing the extracted permanent-settings builder locally with equivalent ABI/helper bindings and the reference vault's settings reproduced the live transaction's input byte for byte. This strongly supports a curator-app flow; a transaction cannot prove the originating website. The deployment salt also differs from Monarch's current `MONARCH_0` through `MONARCH_99` salt set.

Source SHA-256 values, in the same order as the two links above:

```text
27e21a49b61a181189e54f3ac1b95508a110e471dd2cde9e5f0ca9138629b1c4
2dd2de7932fa4c90bd7b0ea0277d59b817e7d445d308df1d97856521c58587b5
```

## Result for Monarch

- The dead-share formula, receiver, and USDC amount agree. Monarch requires an exact seed allowance and checks current supply, price, and wallet balance again after approval.
- Monarch combines seed and adapter/role configuration in one vault multicall. It clears existing exit gates before minting and abdication, and mints before adapter, rate, and fee changes. The curator reference puts registry/gate abdications before minting; either sequence reverts atomically if a call fails.
- The comparison exposed a resumed-setup bug: a local Base-fork reproduction completed setup with a nonzero `sendSharesGate`, abdicated its setter, and left `canSendShares(user)` false. The corrected callback clears the gate and leaves transfers enabled. Permanently configured nonzero gates require review; failed gate reads stop setup, and completion requires all three gates to be zero.
- Both flows still separate deployment from seeding. Current-state checks do not guarantee the seed wins a race with another deposit. Existing funded vaults require historical review, and underlying market/Vault V1 dead-share requirements remain separate.

The chain inspection was read-only. Transaction execution tests used a local Anvil fork, with no public-chain broadcasts.
