import { useMemo } from 'react';

export type ConditionResult = {
  conditionId: string;
  shouldShow: boolean;
  isLoading: boolean;
};

/**
 * Evaluates personalized notification conditions.
 * Each condition maps to a conditionId used in notification config.
 *
 * Add new conditions here as needed. Each condition should return:
 * - shouldShow: whether the notification should display
 * - isLoading: whether data is still loading (prevents flash)
 *
 * @example
 * ```tsx
 * const conditions = useNotificationConditions();
 * const vaultCondition = conditions.get('vaultSetupIncomplete');
 * if (vaultCondition?.shouldShow) { ... }
 * ```
 */
export const useNotificationConditions = (): Map<string, ConditionResult> => {
  const conditions = useMemo(() => {
    const map = new Map<string, ConditionResult>();

    // Add conditions here as needed
    // Example:
    // map.set('vaultSetupIncomplete', {
    //   conditionId: 'vaultSetupIncomplete',
    //   shouldShow: /* check if user has vault needing setup */,
    //   isLoading: /* loading state */,
    // });

    return map;
  }, []);

  return conditions;
};
