import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppSettingsState = {
  // Transaction settings
  usePermit2: boolean;
  useEth: boolean;

  // Display settings
  showUnwhitelistedMarkets: boolean;
  showFullRewardAPY: boolean;
  isAprDisplay: boolean;
};

type AppSettingsActions = {
  setUsePermit2: (use: boolean) => void;
  setUseEth: (use: boolean) => void;
  setShowUnwhitelistedMarkets: (show: boolean) => void;
  setShowFullRewardAPY: (show: boolean) => void;
  setIsAprDisplay: (isApr: boolean) => void;

  // Bulk update for migration
  setAll: (state: Partial<AppSettingsState>) => void;
};

type AppSettingsStore = AppSettingsState & AppSettingsActions;

/**
 * Zustand store for global app settings.
 * Persisted to localStorage to survive page refreshes.
 *
 * **Migration:** Handled by StorageMigrator component
 * **Store key:** `monarch_store_appSettings`
 * **Old keys:**
 * - `usePermit2`
 * - `useEth`
 * - `showUnwhitelistedMarkets`
 * - `showFullRewardAPY`
 * - `settings-apr-display`
 *
 * @example
 * ```tsx
 * const { usePermit2, setUsePermit2 } = useAppSettings();
 * const { showFullRewardAPY } = useAppSettings();
 * ```
 */
export const useAppSettings = create<AppSettingsStore>()(
  persist(
    (set) => ({
      // Default state
      usePermit2: true,
      useEth: false,
      showUnwhitelistedMarkets: false,
      showFullRewardAPY: false,
      isAprDisplay: false,

      // Actions
      setUsePermit2: (use) => set({ usePermit2: use }),
      setUseEth: (use) => set({ useEth: use }),
      setShowUnwhitelistedMarkets: (show) => set({ showUnwhitelistedMarkets: show }),
      setShowFullRewardAPY: (show) => set({ showFullRewardAPY: show }),
      setIsAprDisplay: (isApr) => set({ isAprDisplay: isApr }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_appSettings',
    },
  ),
);
