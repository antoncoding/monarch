import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
  type BorrowedTableColumnVisibility,
} from '@/features/positions/components/borrowed-table-column-visibility';

type PositionsPreferencesState = {
  showCollateralExposure: boolean;
  showEarningsInUsd: boolean;
  borrowedTableColumnVisibility: BorrowedTableColumnVisibility;
};

type PositionsPreferencesActions = {
  setShowCollateralExposure: (show: boolean) => void;
  setShowEarningsInUsd: (show: boolean) => void;
  setBorrowedTableColumnVisibility: (
    visibilityOrUpdater: BorrowedTableColumnVisibility | ((prev: BorrowedTableColumnVisibility) => BorrowedTableColumnVisibility),
  ) => void;

  // Bulk update for migration
  setAll: (state: Partial<PositionsPreferencesState>) => void;
};

type PositionsPreferencesStore = PositionsPreferencesState & PositionsPreferencesActions;

/**
 * Zustand store for positions page preferences.
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
      showEarningsInUsd: false,
      borrowedTableColumnVisibility: DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,

      // Actions
      setShowCollateralExposure: (show) => set({ showCollateralExposure: show }),
      setShowEarningsInUsd: (show) => set({ showEarningsInUsd: show }),
      setBorrowedTableColumnVisibility: (visibilityOrUpdater) =>
        set((state) => ({
          borrowedTableColumnVisibility:
            typeof visibilityOrUpdater === 'function' ? visibilityOrUpdater(state.borrowedTableColumnVisibility) : visibilityOrUpdater,
        })),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_positionsPreferences',
      version: 2,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return {
            showCollateralExposure: true,
            showEarningsInUsd: false,
            borrowedTableColumnVisibility: DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
          } as PositionsPreferencesState;
        }

        const persisted = state as Partial<PositionsPreferencesState>;

        if (version < 2) {
          return {
            ...persisted,
            showCollateralExposure: persisted.showCollateralExposure ?? true,
            showEarningsInUsd: persisted.showEarningsInUsd ?? false,
            borrowedTableColumnVisibility: {
              ...DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
              ...(persisted.borrowedTableColumnVisibility ?? {}),
            },
          } as PositionsPreferencesState;
        }

        return {
          ...persisted,
          showCollateralExposure: persisted.showCollateralExposure ?? true,
          showEarningsInUsd: persisted.showEarningsInUsd ?? false,
          borrowedTableColumnVisibility: {
            ...DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
            ...(persisted.borrowedTableColumnVisibility ?? {}),
          },
        } as PositionsPreferencesState;
      },
    },
  ),
);
