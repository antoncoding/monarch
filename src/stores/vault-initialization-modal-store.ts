import { create } from 'zustand';

type VaultInitializationModalState = {
  isOpen: boolean;
};

type VaultInitializationModalActions = {
  /**
   * Open the initialization modal
   */
  open: () => void;

  /**
   * Close the initialization modal
   */
  close: () => void;
};

type VaultInitializationModalStore = VaultInitializationModalState & VaultInitializationModalActions;

/**
 * Zustand store for vault initialization modal state.
 * Manages modal visibility for the vault setup flow.
 *
 * @example
 * ```tsx
 * // Open initialization modal
 * const { open } = useVaultInitializationModalStore();
 * open();
 *
 * // In modal component
 * const { isOpen, close } = useVaultInitializationModalStore();
 * ```
 */
export const useVaultInitializationModalStore = create<VaultInitializationModalStore>((set) => ({
  isOpen: false,

  open: () => {
    set({ isOpen: true });
  },

  close: () => {
    set({ isOpen: false });
  },
}));
