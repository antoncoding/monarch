import type React from 'react';
import { Cross2Icon } from '@radix-ui/react-icons';
import { twMerge } from 'tailwind-merge';

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
  const controlPositionClass = isStandard ? 'top-6 right-6' : 'top-4 right-4';
  const contentRightPadding = topRightControls ? (isStandard ? 'pr-14' : 'pr-10') : '';
  const handleAuxiliaryClick = auxiliaryAction?.onClick;
  const handleClose = onClose;
  const iconButtonBaseClass =
    'flex h-8 w-8 items-center justify-center rounded-full text-secondary transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70';

  // If children are provided, use them directly (for custom layouts)
  if (children) {
    return <div className={twMerge('flex flex-col gap-1 font-zen', paddingClass, className)}>{children}</div>;
  }

  // Standard layout with title, description, and optional icon
  return (
    <div className={twMerge('relative font-zen font-normal', paddingClass, className)}>
      <div className={twMerge('flex flex-col gap-2', contentRightPadding)}>
        <div className="flex items-center gap-3 text-primary font-normal">
          {mainIcon && <div className="flex-shrink-0">{mainIcon}</div>}
          <span className={`${titleSizeClass} leading-tight`}>{title}</span>
        </div>
        {description && <div className={`${descriptionSizeClass} text-secondary font-zen text-normal`}>{description}</div>}
      </div>
      {topRightControls && (
        <div className={`absolute flex items-center gap-2 ${controlPositionClass}`}>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          {auxiliaryAction && handleAuxiliaryClick && (
            <button
              type="button"
              onClick={handleAuxiliaryClick}
              aria-label={auxiliaryAction.ariaLabel}
              className={iconButtonBaseClass}
            >
              {auxiliaryAction.icon}
            </button>
          )}
          {showCloseIcon && handleClose && (
            <button
              type="button"
              onClick={handleClose}
              aria-label={closeButtonAriaLabel}
              className={iconButtonBaseClass}
            >
              <Cross2Icon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
