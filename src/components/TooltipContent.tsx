import React from 'react';

import { ReactNode } from 'react';

type TooltipContentProps = {
  icon?: ReactNode;
  title?: string;
  detail?: string;
  className?: string;
};

export function TooltipContent({ icon, title, detail, className = '' }: TooltipContentProps) {
  // Simple tooltip with just an icon and title
  if (!detail) {
    return (
      <div
        className={`bg-surface flex items-center gap-2 rounded-sm border border-gray-200/20 p-2 dark:border-gray-600/15 ${className}`}
      >
        {icon && <div className="flex items-center">{icon}</div>}
        <span className="font-zen text-primary">{title}</span>
      </div>
    );
  }

  // Complex tooltip with additional details
  return (
    <div
      className={`bg-surface flex rounded-sm border border-gray-200/20 p-4 dark:border-gray-600/15 ${className}`}
    >
      <div className="flex w-full gap-4">
        {icon && <div className="flex-shrink-0 self-center">{icon}</div>}
        <div className="flex flex-col gap-1">
          {title && <div className="font-zen font-bold text-primary">{title}</div>}
          <div className="font-zen text-sm text-primary">{detail}</div>
        </div>
      </div>
    </div>
  );
}
