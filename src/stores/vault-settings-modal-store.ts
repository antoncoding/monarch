import { create } from 'zustand';

export type SettingsTab = 'general' | 'agents' | 'caps';

type VaultSettingsModalState = {
  isOpen: boolean;
  activeTab: SettingsTab;
};

type VaultSettingsModalActions = {
  /**
   * Open the settings modal, optionally specifying which tab to show
   */
  open: (tab?: SettingsTab) => void;

  /**
   * Close the settings modal
   */
  close: () => void;

  /**
   * Switch to a different tab
   */
  setTab: (tab: SettingsTab) => void;
};

type VaultSettingsModalStore = VaultSettingsModalState & VaultSettingsModalActions;

/**
 * Zustand store for vault settings modal state.
 * Manages modal visibility and active tab selection.
 *
 * @example
 * ```tsx
 * // Open settings modal on agents tab
 * const { open } = useVaultSettingsModalStore();
 * open('agents');
 *
 * // In modal component
 * const { isOpen, activeTab, close } = useVaultSettingsModalStore();
 * ```
 */
export const useVaultSettingsModalStore = create<VaultSettingsModalStore>((set) => ({
  isOpen: false,
  activeTab: 'general',

  open: (tab = 'general') => {
    set({ isOpen: true, activeTab: tab });
  },

  close: () => {
    set({ isOpen: false });
  },

  setTab: (tab) => {
    set({ activeTab: tab });
  },
}));
