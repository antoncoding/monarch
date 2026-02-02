import { useMemo } from 'react';
import { NOTIFICATIONS, type NotificationConfig } from '@/config/notifications';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useNotificationConditions } from './useNotificationConditions';

export type ActiveNotificationsResult = {
  /** Current notification to display (first in queue) */
  currentNotification: NotificationConfig | null;
  /** Total count of active notifications (for badge) */
  totalCount: number;
  /** Current position in queue (1-indexed) */
  currentIndex: number;
  /** Whether conditions are still loading */
  isLoading: boolean;
  /** All active notifications */
  activeNotifications: NotificationConfig[];
};

/**
 * Combines notification config, dismissed state, and conditions
 * to return the list of active notifications.
 *
 * Filters out:
 * - Expired notifications (expiresAt < now)
 * - Dismissed notifications (in localStorage)
 * - Personalized notifications where condition is false or loading
 *
 * @example
 * ```tsx
 * const { currentNotification, totalCount, isLoading } = useActiveNotifications();
 *
 * if (!isLoading && currentNotification) {
 *   // Render notification banner
 * }
 * ```
 */
export const useActiveNotifications = (): ActiveNotificationsResult => {
  const dismissedIds = useNotificationStore((s) => s.dismissedIds);
  const hasHydrated = useNotificationStore((s) => s._hasHydrated);
  const conditions = useNotificationConditions();

  const { activeNotifications, isLoading } = useMemo(() => {
    // Don't show any notifications until the store has hydrated from localStorage
    // This prevents dismissed notifications from flashing briefly on page load
    if (!hasHydrated) {
      return { activeNotifications: [], isLoading: true };
    }
    const now = new Date();
    let hasLoadingCondition = false;

    const active = NOTIFICATIONS.filter((notification) => {
      // Check if expired
      if (notification.expiresAt && notification.expiresAt < now) {
        return false;
      }

      // Check if dismissed
      if (dismissedIds.includes(notification.id)) {
        return false;
      }

      // For personalized notifications, check condition
      if (notification.category === 'personalized' && notification.conditionId) {
        const condition = conditions.get(notification.conditionId);

        // If condition not found, don't show
        if (!condition) {
          return false;
        }

        // Track loading state
        if (condition.isLoading) {
          hasLoadingCondition = true;
          return false;
        }

        // Only show if condition is true
        if (!condition.shouldShow) {
          return false;
        }
      }

      return true;
    });

    return {
      activeNotifications: active,
      isLoading: hasLoadingCondition,
    };
  }, [dismissedIds, conditions, hasHydrated]);

  const currentNotification = activeNotifications[0] ?? null;
  const totalCount = activeNotifications.length;

  return {
    currentNotification,
    totalCount,
    currentIndex: totalCount > 0 ? 1 : 0,
    isLoading,
    activeNotifications,
  };
};
