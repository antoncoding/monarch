import { create } from 'zustand';

export type VaultSettingsCategory = 'general' | 'agents' | 'caps';
export type VaultDetailView = 'edit-caps' | null;

type VaultSettingsModalState = {
  isOpen: boolean;
  activeCategory: VaultSettingsCategory;
  activeDetailView: VaultDetailView;
  slideDirection: 'forward' | 'backward';
};

type VaultSettingsModalActions = {
  /**
   * Open the settings modal, optionally specifying which category to show
   */
  open: (category?: VaultSettingsCategory) => void;

  /**
   * Close the settings modal and reset state
   */
  close: () => void;

  /**
   * Switch to a different category (resets detail view)
   */
  setCategory: (category: VaultSettingsCategory) => void;

  /**
   * Navigate to a detail view with slide animation
   */
  navigateToDetail: (view: Exclude<VaultDetailView, null>) => void;

  /**
   * Navigate back from detail view with slide animation
   */
  navigateBack: () => void;
};

type VaultSettingsModalStore = VaultSettingsModalState & VaultSettingsModalActions;

/**
 * Zustand store for vault settings modal state.
 * Manages modal visibility, category selection, and detail view navigation.
 *
 * @example
 * ```tsx
 * // Open settings modal on agents category
 * const { open } = useVaultSettingsModalStore();
 * open('agents');
 *
 * // Navigate to edit caps detail view
 * const { navigateToDetail } = useVaultSettingsModalStore();
 * navigateToDetail('edit-caps');
 *
 * // In modal component
 * const { isOpen, activeCategory, activeDetailView, close } = useVaultSettingsModalStore();
 * ```
 */
export const useVaultSettingsModalStore = create<VaultSettingsModalStore>((set) => ({
  isOpen: false,
  activeCategory: 'general',
  activeDetailView: null,
  slideDirection: 'forward',

  open: (category = 'general') => {
    set({
      isOpen: true,
      activeCategory: category,
      activeDetailView: null,
      slideDirection: 'forward',
    });
  },

  close: () => {
    set({
      isOpen: false,
      activeDetailView: null,
      slideDirection: 'forward',
    });
  },

  setCategory: (category) => {
    set((state) => {
      // If in detail view, slide backward first
      if (state.activeDetailView !== null) {
        return {
          activeCategory: category,
          activeDetailView: null,
          slideDirection: 'backward',
        };
      }
      return { activeCategory: category };
    });
  },

  navigateToDetail: (view) => {
    set({
      activeDetailView: view,
      slideDirection: 'forward',
    });
  },

  navigateBack: () => {
    set({
      activeDetailView: null,
      slideDirection: 'backward',
    });
  },
}));
