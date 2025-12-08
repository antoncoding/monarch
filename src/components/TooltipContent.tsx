import type React from 'react';

import type { ReactNode } from 'react';

type TooltipContentProps = {
  icon?: ReactNode;
  title?: ReactNode;
  detail?: ReactNode;
  secondaryDetail?: ReactNode;
  className?: string;
  actionIcon?: ReactNode;
  actionHref?: string;
  onActionClick?: (e: React.MouseEvent) => void;
};

export function TooltipContent({
  icon,
  title,
  detail,
  secondaryDetail,
  className = '',
  actionIcon,
  actionHref,
  onActionClick,
}: TooltipContentProps) {
  // Simple tooltip with just an icon and title
  if (!detail && !secondaryDetail) {
    return (
      <div className={`bg-surface flex items-center gap-2 rounded-sm border border-gray-200/20 p-2 dark:border-gray-600/15 ${className}`}>
        {icon && <div className="flex items-center">{icon}</div>}
        <span className="font-zen text-primary">{title}</span>
        {actionIcon && actionHref && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onActionClick}
            className="ml-auto text-secondary hover:text-primary transition-colors text-sm"
          >
            {actionIcon}
          </a>
        )}
      </div>
    );
  }

  // Complex tooltip with additional details
  return (
    <div className={`bg-surface rounded-sm border border-gray-200/20 p-4 dark:border-gray-600/15 ${className}`}>
      <div className="flex w-full gap-4">
        {icon && <div className="flex-shrink-0 self-center">{icon}</div>}
        <div className="flex flex-col gap-1 flex-1">
          {title && <div className="font-zen font-bold text-primary">{title}</div>}
          {detail && <div className="font-zen text-sm text-primary">{detail}</div>}
          {secondaryDetail && <div className="font-zen text-xs text-secondary">{secondaryDetail}</div>}
        </div>
        {actionIcon && actionHref && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onActionClick}
            className="flex-shrink-0 self-start text-secondary hover:text-primary transition-colors"
          >
            {actionIcon}
          </a>
        )}
      </div>
    </div>
  );
}
