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
      <div className={`flex items-center gap-2 rounded-sm p-2 ${className}`}>
        {icon && <div className="flex items-center">{icon}</div>}
        <span className="font-zen">{title}</span>
      </div>
    );
  }

  // Complex tooltip with additional details
  return (
    <div className={`flex rounded-sm p-4 opacity-80 ${className}`}>
      <div className="flex w-full gap-4">
        {icon && <div className="flex-shrink-0 self-center">{icon}</div>}
        <div className="flex flex-col gap-1">
          {title && <div className="font-zen font-bold">{title}</div>}
          <div className="font-zen text-sm">{detail}</div>
        </div>
      </div>
    </div>
  );
}
