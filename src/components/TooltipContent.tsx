import React from 'react';

import { ReactNode } from 'react';

type WarningDetail = {
  description: string;
};

type TooltipContentProps = {
  icon?: ReactNode;
  title?: string;
  detail?: string;
  className?: string;
};

export function TooltipContent({
  icon,
  title,
  detail,
  className = '',
}: TooltipContentProps) {
  // Simple tooltip with just an icon and description
  if (!detail) {
    return (
      <div className={`flex items-center gap-2 rounded-sm p-2 ${className}`}>
        {icon}
        <span className="font-zen">{title}</span>
      </div>
    );
  }

  // Complex tooltip with additional warning details
  return (
    <div className={`flex items-center rounded-sm p-4 opacity-80 ${className}`}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex flex-col gap-1">
          {title && <div className="font-zen font-medium">{title}</div>}
          <div className="font-zen text-sm">{detail}</div>
        </div>
      </div>
    </div>
  );
}
