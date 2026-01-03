import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type NotificationState = {
  /** Set of dismissed notification IDs */
  dismissedIds: string[];
};

type NotificationActions = {
  /** Dismiss a notification by ID */
  dismiss: (id: string) => void;
  /** Check if a notification is dismissed */
  isDismissed: (id: string) => boolean;
  /** Bulk update for migration */
  setAll: (state: Partial<NotificationState>) => void;
};

type NotificationStore = NotificationState & NotificationActions;

/**
 * Zustand store for tracking dismissed notification IDs.
 * Automatically persisted to localStorage.
 *
 * @example
 * ```tsx
 * const dismiss = useNotificationStore((s) => s.dismiss);
 * const isDismissed = useNotificationStore((s) => s.isDismissed);
 *
 * // Dismiss a notification
 * dismiss('notification-id');
 *
 * // Check if dismissed
 * if (isDismissed('notification-id')) { ... }
 * ```
 */
export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      dismissedIds: [],

      dismiss: (id) => {
        const { dismissedIds } = get();
        if (!dismissedIds.includes(id)) {
          set({ dismissedIds: [...dismissedIds, id] });
        }
      },

      isDismissed: (id) => {
        return get().dismissedIds.includes(id);
      },

      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_notifications',
    },
  ),
);
