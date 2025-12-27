import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultTrustedVaults, getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';

type TrustedVaultsState = {
  vaults: TrustedVault[];
};

type TrustedVaultsActions = {
  /**
   * Add a vault to the trusted list
   */
  addVault: (vault: TrustedVault) => void;

  /**
   * Remove a vault from the trusted list by address and chainId
   */
  removeVault: (address: string, chainId: number) => void;

  /**
   * Set the entire trusted vaults list (useful for reset or bulk updates)
   */
  setVaults: (vaults: TrustedVault[]) => void;

  /**
   * Check if a vault is in the trusted list
   */
  isVaultTrusted: (address: string, chainId: number) => boolean;
};

type TrustedVaultsStore = TrustedVaultsState & TrustedVaultsActions;

/**
 * Zustand store for managing trusted vaults.
 * Persisted to localStorage to survive page refreshes.
 *
 * @example
 * ```tsx
 * const { vaults, addVault, removeVault } = useTrustedVaults();
 *
 * // Add a vault
 * addVault({ address: '0x123...', chainId: 1, name: 'My Vault' });
 *
 * // Check if trusted
 * const isTrusted = useTrustedVaults.getState().isVaultTrusted('0x123...', 1);
 * ```
 */
export const useTrustedVaults = create<TrustedVaultsStore>()(
  persist(
    (set, get) => ({
      vaults: defaultTrustedVaults,

      addVault: (vault) => {
        const { vaults } = get();
        const vaultKey = getVaultKey(vault.address, vault.chainId);

        // Check if vault already exists
        const exists = vaults.some((v) => getVaultKey(v.address, v.chainId) === vaultKey);

        if (!exists) {
          set({ vaults: [...vaults, vault] });
        }
      },

      removeVault: (address, chainId) => {
        const { vaults } = get();
        const vaultKey = getVaultKey(address, chainId);

        set({
          vaults: vaults.filter((v) => getVaultKey(v.address, v.chainId) !== vaultKey),
        });
      },

      setVaults: (vaults) => {
        set({ vaults });
      },

      isVaultTrusted: (address, chainId) => {
        const { vaults } = get();
        const vaultKey = getVaultKey(address, chainId);
        return vaults.some((v) => getVaultKey(v.address, v.chainId) === vaultKey);
      },
    }),
    {
      name: 'monarch_store_trustedVaults', // DIFFERENT key from old 'userTrustedVaults'
    },
  ),
);
