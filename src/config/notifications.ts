import type { ReactNode } from 'react';

export type NotificationType = 'info' | 'warning' | 'success' | 'alert';

export type NotificationAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type NotificationConfig = {
  /** Unique identifier for persistence */
  id: string;
  /** Message to display in the banner */
  message: string;
  /** Optional custom icon (ReactNode) */
  icon?: ReactNode;
  /** Notification type for styling */
  type: NotificationType;
  /** Optional action button */
  action?: NotificationAction;
  /** Optional expiration date - notification auto-hides after this */
  expiresAt?: Date;
  /** Category: global (all users) or personalized (condition-based) */
  category: 'global' | 'personalized';
  /** For personalized notifications, maps to a condition in useNotificationConditions */
  conditionId?: string;
};

/**
 * Centralized notification definitions.
 * Add new notifications here with a unique id.
 *
 * Global notifications show to all users until dismissed or expired.
 * Personalized notifications require a conditionId that maps to useNotificationConditions.
 */
export const NOTIFICATIONS: NotificationConfig[] = [
  {
    id: 'leverage-live-2026-03-06-v2',
    message: '🚀 Leverage is now live on Monarch. See what is new and how to get started.',
    type: 'success',
    category: 'global',
    action: {
      label: 'Read update',
      href: '/posts/2026-03-06-leverage',
    },
    expiresAt: new Date('2026-03-10T23:59:59.999Z'),
  },
];
