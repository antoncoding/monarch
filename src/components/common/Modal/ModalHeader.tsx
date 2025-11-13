import React from 'react';
import { ModalHeader as HeroModalHeader } from '@heroui/react';

export type ModalHeaderVariant = 'standard' | 'compact';

type ModalHeaderProps = {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  variant?: ModalHeaderVariant;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
};

export function ModalHeader({
  title,
  description,
  icon,
  variant = 'standard',
  children,
  className = '',
  actions,
}: ModalHeaderProps) {
  const isStandard = variant === 'standard';
  const paddingClass = isStandard ? 'px-10 pt-6' : 'px-6 pt-4';
  const titleSizeClass = isStandard ? 'text-lg' : 'text-base';

  // If children are provided, use them directly (for custom layouts)
  if (children) {
    return (
      <HeroModalHeader className={`flex flex-col gap-1 font-zen ${paddingClass} ${className}`}>
        {children}
      </HeroModalHeader>
    );
  }

  // Standard layout with title, description, and optional icon
  return (
    <HeroModalHeader className={`flex ${actions ? 'items-center justify-between' : 'flex-col gap-1'} font-zen ${paddingClass} ${className}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <span className={`${titleSizeClass} font-normal text-primary`}>
            {title}
          </span>
        </div>
        {description && (
          <span className="text-sm font-normal text-secondary">
            {description}
          </span>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </HeroModalHeader>
  );
}
