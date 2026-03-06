import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const NOTIFICATIONS_STORAGE_KEY = 'monarch_store_notifications';

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const getInitialDismissedIds = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const persistedValue = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!persistedValue) {
      return [];
    }

    const parsed = JSON.parse(persistedValue) as { state?: { dismissedIds?: unknown } };
    const dismissedIds = parsed.state?.dismissedIds;

    return isStringArray(dismissedIds) ? dismissedIds : [];
  } catch {
    return [];
  }
};

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
      dismissedIds: getInitialDismissedIds(),

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
      name: NOTIFICATIONS_STORAGE_KEY,
      partialize: (state) => ({ dismissedIds: state.dismissedIds }),
    },
  ),
);
