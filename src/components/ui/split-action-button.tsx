'use client';

import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/utils/index';

type DropdownItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type IndicatorConfig = {
  show: boolean;
  tooltip?: ReactNode;
};

type SplitActionButtonProps = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  indicator?: IndicatorConfig;
  dropdownItems: DropdownItem[];
  className?: string;
};

export function SplitActionButton({
  label,
  icon,
  onClick,
  indicator,
  dropdownItems,
  className,
}: SplitActionButtonProps): ReactNode {
  const showIndicator = indicator?.show ?? false;

  const mainButton = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 pl-3 pr-2 py-2 text-sm font-medium transition-all duration-200',
        'rounded-l-sm rounded-r-none',
        'bg-surface text-foreground hover:brightness-95',
        'active:scale-[0.98] active:brightness-90',
      )}
    >
      {showIndicator && <span className="h-2 w-2 rounded-full bg-primary block" />}
      {icon}
      {label}
    </button>
  );

  const wrappedButton = showIndicator && indicator?.tooltip
    ? <Tooltip content={indicator.tooltip}>{mainButton}</Tooltip>
    : mainButton;

  return (
    <div className={cn(
      'inline-flex items-stretch shadow-sm',
      'hover:shadow-md transition-shadow',
      className,
    )}>
      {wrappedButton}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center px-1 transition-all duration-200',
              'rounded-l-none rounded-r-sm',
              'bg-surface text-foreground hover:brightness-95',
              'border-l border-border/20',
              'active:brightness-90',
            )}
          >
            <ChevronDownIcon className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-0 p-1">
          {dropdownItems.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.onClick}
              disabled={item.disabled}
              startContent={item.icon}
              className="px-2 py-2 text-sm gap-1.5"
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
