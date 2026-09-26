import { toFunctionSelector } from 'viem';

export const VAULT_V2_EXIT_CRITICAL_GATES = [
  { getter: 'receiveSharesGate', setter: 'setReceiveSharesGate' },
  { getter: 'sendSharesGate', setter: 'setSendSharesGate' },
  { getter: 'receiveAssetsGate', setter: 'setReceiveAssetsGate' },
] as const;

export const VAULT_V2_SET_ADAPTER_REGISTRY_SIGNATURE = 'setAdapterRegistry(address)' as const;

export const VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS = VAULT_V2_EXIT_CRITICAL_GATES.map(({ setter }) =>
  toFunctionSelector(`${setter}(address)`),
);

export const VAULT_V2_SET_ADAPTER_REGISTRY_SELECTOR = toFunctionSelector(VAULT_V2_SET_ADAPTER_REGISTRY_SIGNATURE);

export const VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS = [
  ...VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS,
  VAULT_V2_SET_ADAPTER_REGISTRY_SELECTOR,
];

export const VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY = 5_000_000_000_000_000n; // 0.5%, WAD-scaled.
export const VAULT_V2_DEFAULT_MAX_RATE = 63_419_583_967n; // 200% APR.

export const VAULT_V2_DEAD_DEPOSIT_RECEIVER = '0x000000000000000000000000000000000000dEaD' as const;

/** Morpho's minimum seed: https://docs.morpho.org/curate/tutorials-v2/dead-deposit/ */
export function getVaultV2DeadDepositAmounts(assetDecimals: number) {
  if (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 255) {
    throw new Error('Invalid underlying token decimals');
  }

  const virtualShares = 10n ** BigInt(Math.max(0, 18 - assetDecimals));
  const inflationProtectionShares = 1_000_000n * virtualShares;
  const shares = inflationProtectionShares > 1_000_000_000n ? inflationProtectionShares : 1_000_000_000n;

  return { shares, assets: shares / virtualShares };
}
