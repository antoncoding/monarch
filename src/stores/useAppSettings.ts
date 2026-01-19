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

  // UI dismissals
  trustedVaultsWarningDismissed: boolean;
};

type AppSettingsActions = {
  setUsePermit2: (use: boolean) => void;
  setUseEth: (use: boolean) => void;
  setShowUnwhitelistedMarkets: (show: boolean) => void;
  setShowFullRewardAPY: (show: boolean) => void;
  setIsAprDisplay: (isApr: boolean) => void;
  setTrustedVaultsWarningDismissed: (dismissed: boolean) => void;

  // Bulk update for migration
  setAll: (state: Partial<AppSettingsState>) => void;
};

type AppSettingsStore = AppSettingsState & AppSettingsActions;
/**
 * Zustand store for global app settings (transaction preferences, display options).
 * Automatically persisted to localStorage.
 *
 * @example
 * ```tsx
 * const { usePermit2, setUsePermit2 } = useAppSettings();
 * const { useEth, showFullRewardAPY } = useAppSettings();
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
      trustedVaultsWarningDismissed: false,

      // Actions
      setUsePermit2: (use) => set({ usePermit2: use }),
      setUseEth: (use) => set({ useEth: use }),
      setShowUnwhitelistedMarkets: (show) => set({ showUnwhitelistedMarkets: show }),
      setShowFullRewardAPY: (show) => set({ showFullRewardAPY: show }),
      setIsAprDisplay: (isApr) => set({ isAprDisplay: isApr }),
      setTrustedVaultsWarningDismissed: (dismissed) => set({ trustedVaultsWarningDismissed: dismissed }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_appSettings',
    },
  ),
);
