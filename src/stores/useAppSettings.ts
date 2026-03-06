import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RebalanceDefaultMode = 'manual' | 'smart';

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
  specialBundlerWarningAcknowledgements: Record<string, boolean>;

  // Developer options
  showDeveloperOptions: boolean;

  // Public Allocator (source liquidity)
  usePublicAllocator: boolean;

  // Leverage modal preferences
  leverageUseTargetLtvInput: boolean;
  deleverageUseTargetLtvInput: boolean;

  // Rebalance modal preferences
  rebalanceDefaultMode: RebalanceDefaultMode;
};

type AppSettingsActions = {
  setUsePermit2: (use: boolean) => void;
  setUseEth: (use: boolean) => void;
  setShowUnwhitelistedMarkets: (show: boolean) => void;
  setShowFullRewardAPY: (show: boolean) => void;
  setIsAprDisplay: (isApr: boolean) => void;
  setTrustedVaultsWarningDismissed: (dismissed: boolean) => void;
  setSpecialBundlerWarningAcknowledged: (warningStorageKey: string, acknowledged: boolean) => void;
  setShowDeveloperOptions: (show: boolean) => void;
  setUsePublicAllocator: (show: boolean) => void;
  setLeverageUseTargetLtvInput: (useTargetLtvInput: boolean) => void;
  setDeleverageUseTargetLtvInput: (useTargetLtvInput: boolean) => void;
  setRebalanceDefaultMode: (mode: RebalanceDefaultMode) => void;

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
      showFullRewardAPY: true,
      isAprDisplay: false,
      trustedVaultsWarningDismissed: false,
      specialBundlerWarningAcknowledgements: {},
      showDeveloperOptions: false,
      usePublicAllocator: true,
      leverageUseTargetLtvInput: true,
      deleverageUseTargetLtvInput: true,
      rebalanceDefaultMode: 'smart',

      // Actions
      setUsePermit2: (use) => set({ usePermit2: use }),
      setUseEth: (use) => set({ useEth: use }),
      setShowUnwhitelistedMarkets: (show) => set({ showUnwhitelistedMarkets: show }),
      setShowFullRewardAPY: (show) => set({ showFullRewardAPY: show }),
      setIsAprDisplay: (isApr) => set({ isAprDisplay: isApr }),
      setTrustedVaultsWarningDismissed: (dismissed) => set({ trustedVaultsWarningDismissed: dismissed }),
      setSpecialBundlerWarningAcknowledged: (warningStorageKey, acknowledged) =>
        set((state) => ({
          specialBundlerWarningAcknowledgements: {
            ...state.specialBundlerWarningAcknowledgements,
            [warningStorageKey]: acknowledged,
          },
        })),
      setShowDeveloperOptions: (show) => set({ showDeveloperOptions: show }),
      setUsePublicAllocator: (show) => set({ usePublicAllocator: show }),
      setLeverageUseTargetLtvInput: (useTargetLtvInput) => set({ leverageUseTargetLtvInput: useTargetLtvInput }),
      setDeleverageUseTargetLtvInput: (useTargetLtvInput) => set({ deleverageUseTargetLtvInput: useTargetLtvInput }),
      setRebalanceDefaultMode: (mode) => set({ rebalanceDefaultMode: mode }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_appSettings',
    },
  ),
);
