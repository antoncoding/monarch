import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type HistoryPreferencesState = {
  entriesPerPage: number;
  isGroupedView: boolean;
};

type HistoryPreferencesActions = {
  setEntriesPerPage: (count: number) => void;
  setIsGroupedView: (grouped: boolean) => void;

  // Bulk update for migration
  setAll: (state: Partial<HistoryPreferencesState>) => void;
};

type HistoryPreferencesStore = HistoryPreferencesState & HistoryPreferencesActions;

/**
 * Zustand store for history table preferences.
 *
 * @example
 * ```tsx
 * const { entriesPerPage, setEntriesPerPage } = useHistoryPreferences();
 * const { isGroupedView, setIsGroupedView } = useHistoryPreferences();
 * ```
 */
export const useHistoryPreferences = create<HistoryPreferencesStore>()(
  persist(
    (set) => ({
      // Default state
      entriesPerPage: 10,
      isGroupedView: true,

      // Actions
      setEntriesPerPage: (count) => set({ entriesPerPage: count }),
      setIsGroupedView: (grouped) => set({ isGroupedView: grouped }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_historyPreferences',
    },
  ),
);
