import { toFunctionSelector } from 'viem';

export const VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SIGNATURES = [
  'setReceiveSharesGate(address)',
  'setSendSharesGate(address)',
  'setReceiveAssetsGate(address)',
] as const;

export const VAULT_V2_SET_ADAPTER_REGISTRY_SIGNATURE = 'setAdapterRegistry(address)' as const;

export const VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS = VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SIGNATURES.map(toFunctionSelector);

export const VAULT_V2_SET_ADAPTER_REGISTRY_SELECTOR = toFunctionSelector(VAULT_V2_SET_ADAPTER_REGISTRY_SIGNATURE);

export const VAULT_V2_INITIALIZATION_ABDICATED_SELECTORS = [
  ...VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS,
  VAULT_V2_SET_ADAPTER_REGISTRY_SELECTOR,
];

export const VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY = 5_000_000_000_000_000n; // 0.5%, WAD-scaled.
export const VAULT_V2_DEFAULT_MAX_RATE = 63_419_583_967n; // 200% APR.
