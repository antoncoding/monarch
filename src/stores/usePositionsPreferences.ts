import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
  type BorrowedTableColumnVisibility,
} from '@/features/positions/components/borrowed-table-column-visibility';

export type SuppliedPositionsViewMode = 'grouped' | 'market';

export const CURRENT_POSITIONS_SETTINGS_VERSION = 3;

type PositionsPreferencesState = {
  showCollateralExposure: boolean;
  showEarningsInUsd: boolean;
  hideClosedPositions: boolean;
  suppliedPositionsViewMode: SuppliedPositionsViewMode;
  positionsSettingsSeenVersion: number;
  borrowedTableColumnVisibility: BorrowedTableColumnVisibility;
};

type PositionsPreferencesActions = {
  setShowCollateralExposure: (show: boolean) => void;
  setShowEarningsInUsd: (show: boolean) => void;
  setHideClosedPositions: (hide: boolean) => void;
  setSuppliedPositionsViewMode: (mode: SuppliedPositionsViewMode) => void;
  markPositionsSettingsSeen: () => void;
  setBorrowedTableColumnVisibility: (
    visibilityOrUpdater: BorrowedTableColumnVisibility | ((prev: BorrowedTableColumnVisibility) => BorrowedTableColumnVisibility),
  ) => void;

  // Bulk update for migration
  setAll: (state: Partial<PositionsPreferencesState>) => void;
};

type PositionsPreferencesStore = PositionsPreferencesState & PositionsPreferencesActions;

const DEFAULT_STATE: PositionsPreferencesState = {
  showCollateralExposure: true,
  showEarningsInUsd: false,
  hideClosedPositions: true,
  suppliedPositionsViewMode: 'grouped',
  positionsSettingsSeenVersion: 0,
  borrowedTableColumnVisibility: DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
};

function normalizePositionsPreferences(state: Partial<PositionsPreferencesState>): PositionsPreferencesState {
  return {
    ...DEFAULT_STATE,
    ...state,
    showCollateralExposure: state.showCollateralExposure ?? DEFAULT_STATE.showCollateralExposure,
    showEarningsInUsd: state.showEarningsInUsd ?? DEFAULT_STATE.showEarningsInUsd,
    hideClosedPositions: state.hideClosedPositions ?? DEFAULT_STATE.hideClosedPositions,
    suppliedPositionsViewMode: state.suppliedPositionsViewMode === 'market' ? 'market' : 'grouped',
    positionsSettingsSeenVersion: state.positionsSettingsSeenVersion ?? DEFAULT_STATE.positionsSettingsSeenVersion,
    borrowedTableColumnVisibility: {
      ...DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY,
      ...(state.borrowedTableColumnVisibility ?? {}),
    },
  };
}

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
      ...DEFAULT_STATE,

      // Actions
      setShowCollateralExposure: (show) => set({ showCollateralExposure: show }),
      setShowEarningsInUsd: (show) => set({ showEarningsInUsd: show }),
      setHideClosedPositions: (hide) => set({ hideClosedPositions: hide }),
      setSuppliedPositionsViewMode: (mode) => set({ suppliedPositionsViewMode: mode }),
      markPositionsSettingsSeen: () => set({ positionsSettingsSeenVersion: CURRENT_POSITIONS_SETTINGS_VERSION }),
      setBorrowedTableColumnVisibility: (visibilityOrUpdater) =>
        set((state) => ({
          borrowedTableColumnVisibility:
            typeof visibilityOrUpdater === 'function' ? visibilityOrUpdater(state.borrowedTableColumnVisibility) : visibilityOrUpdater,
        })),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_positionsPreferences',
      version: 5,
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }

        const persisted = state as Partial<PositionsPreferencesState>;

        return normalizePositionsPreferences(persisted);
      },
    },
  ),
);
