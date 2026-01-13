'use client';

import Link from 'next/link';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useActiveNotifications } from '@/hooks/useActiveNotifications';
import { useNotificationStore } from '@/stores/useNotificationStore';

export function NotificationBanner() {
  const { currentNotification, totalCount, isLoading } = useActiveNotifications();
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Don't render if no notification or still loading
  if (!currentNotification || isLoading) {
    return null;
  }

  const handleDismiss = () => {
    dismiss(currentNotification.id);
  };

  const action = currentNotification.action;

  return (
    <div className="relative w-full bg-primary">
      {/* Grid background overlay */}
      <div
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30"
        aria-hidden="true"
      />

      {/* Content container - same height as header */}
      <div className="relative flex h-[48px] items-center md:h-[56px]">
        <div className="container mx-auto flex items-center justify-center gap-4 px-4 sm:px-6 md:px-8">
          {/* Badge for multiple notifications */}
          {totalCount > 1 && <span className="font-zen text-xs text-primary-foreground/80">1/{totalCount}</span>}

          {/* Custom icon if provided */}
          {currentNotification.icon && <span className="text-primary-foreground">{currentNotification.icon}</span>}

          {/* Message */}
          <p className="font-zen text-sm text-primary-foreground">{currentNotification.message}</p>

          {/* Action button */}
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                onClick={handleDismiss}
                className="font-zen text-xs text-primary-foreground underline-offset-2 transition-colors hover:underline"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  action.onClick?.();
                  handleDismiss();
                }}
                className="font-zen text-xs text-primary-foreground underline-offset-2 transition-colors hover:underline"
              >
                {action.label}
              </button>
            ))}

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-4 p-1 text-primary-foreground/80 transition-colors hover:text-primary-foreground sm:right-6 md:right-8"
            aria-label="Dismiss notification"
          >
            <Cross2Icon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if notification banner is currently visible.
 * Used by Header to calculate dynamic spacer height.
 */
export const useNotificationBannerVisible = (): boolean => {
  const { currentNotification, isLoading } = useActiveNotifications();
  return !isLoading && currentNotification !== null;
};
