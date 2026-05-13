import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DATA_NOTICE_DISMISS_MS = 2 * 60 * 60 * 1000;
const DATA_NOTICE_DISMISSALS_STORAGE_KEY = 'monarch_store_dataNoticeDismissals';

type DataNoticeDismissalsStore = {
  dismissedUntilById: Record<string, number>;
  dismiss: (id: string) => void;
  pruneExpired: () => void;
};

const pruneExpiredDismissals = (dismissedUntilById: Record<string, number>, now = Date.now()): Record<string, number> =>
  Object.fromEntries(Object.entries(dismissedUntilById).filter(([, dismissedUntil]) => dismissedUntil > now));

export const useDataNoticeDismissals = create<DataNoticeDismissalsStore>()(
  persist(
    (set) => ({
      dismissedUntilById: {},

      dismiss: (id) => {
        set((state) => ({
          dismissedUntilById: {
            ...pruneExpiredDismissals(state.dismissedUntilById),
            [id]: Date.now() + DATA_NOTICE_DISMISS_MS,
          },
        }));
      },

      pruneExpired: () => {
        set((state) => {
          const dismissedUntilById = pruneExpiredDismissals(state.dismissedUntilById);
          const didPrune = Object.keys(dismissedUntilById).length !== Object.keys(state.dismissedUntilById).length;

          return {
            dismissedUntilById: didPrune ? dismissedUntilById : state.dismissedUntilById,
          };
        });
      },
    }),
    {
      name: DATA_NOTICE_DISMISSALS_STORAGE_KEY,
      partialize: (state) => ({ dismissedUntilById: state.dismissedUntilById }),
    },
  ),
);
