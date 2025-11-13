import React from 'react';
import { ModalHeader as HeroModalHeader } from '@heroui/react';
import { Cross1Icon } from '@radix-ui/react-icons';

export type ModalHeaderVariant = 'standard' | 'compact';

export type ModalHeaderAction = {
  icon: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
};

type ModalHeaderProps = {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  mainIcon?: React.ReactNode;
  variant?: ModalHeaderVariant;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  auxiliaryAction?: ModalHeaderAction;
};

export function ModalHeader({
  title,
  description,
  mainIcon,
  variant = 'standard',
  children,
  className = '',
  actions,
  onClose,
  showCloseButton = true,
  closeButtonAriaLabel = 'Close modal',
  auxiliaryAction,
}: ModalHeaderProps) {
  const isStandard = variant === 'standard';
  const paddingClass = isStandard ? 'px-6 pt-6 pb-4' : 'px-5 pt-4 pb-3';
  const titleSizeClass = isStandard ? 'text-2xl' : 'text-lg';
  const descriptionSizeClass = isStandard ? 'text-sm' : 'text-xs';
  const showCloseIcon = Boolean(onClose) && showCloseButton;
  const topRightControls = Boolean(actions || auxiliaryAction || showCloseIcon);
  const iconButtonBaseClass =
    'flex h-8 w-8 items-center justify-center rounded-full text-secondary transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70';

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
    <HeroModalHeader className={`font-zen ${paddingClass} ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-3 text-primary font-normal">
            {mainIcon && <div className="flex-shrink-0">{mainIcon}</div>}
            <span className={`${titleSizeClass} leading-tight`}>{title}</span>
          </div>
          {description && (
            <span className={`${descriptionSizeClass} text-secondary`}>
              {description}
            </span>
          )}
        </div>
        {topRightControls && (
          <div className="flex flex-shrink-0 items-center gap-2 self-start">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            {auxiliaryAction && (
              <button
                type="button"
                onClick={auxiliaryAction.onClick}
                aria-label={auxiliaryAction.ariaLabel}
                className={iconButtonBaseClass}
              >
                {auxiliaryAction.icon}
              </button>
            )}
            {showCloseIcon && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeButtonAriaLabel}
                className={iconButtonBaseClass}
              >
                <Cross1Icon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </HeroModalHeader>
  );
}
