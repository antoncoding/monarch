import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PositionsPreferencesState = {
  showCollateralExposure: boolean;
};

type PositionsPreferencesActions = {
  setShowCollateralExposure: (show: boolean) => void;

  // Bulk update for migration
  setAll: (state: Partial<PositionsPreferencesState>) => void;
};

type PositionsPreferencesStore = PositionsPreferencesState & PositionsPreferencesActions;

/**
 * Zustand store for positions page preferences.
 * Persisted to localStorage to survive page refreshes.
 *
 * **Migration:** Handled by StorageMigrator component
 * **Store key:** `monarch_store_positionsPreferences`
 * **Old key:** `positions:show-collateral-exposure`
 *
 * @example
 * ```tsx
 * const { showCollateralExposure, setShowCollateralExposure } = usePositionsPreferences();
 * ```
 */
export const usePositionsPreferences = create<PositionsPreferencesStore>()(
  persist(
    (set) => ({
      // Default state
      showCollateralExposure: true,

      // Actions
      setShowCollateralExposure: (show) => set({ showCollateralExposure: show }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_positionsPreferences',
    },
  ),
);
