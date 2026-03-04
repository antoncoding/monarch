import type { ReactNode } from 'react';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/utils/components';

type HelpTooltipIconProps = {
  content: ReactNode;
  ariaLabel?: string;
  className?: string;
  iconClassName?: string;
  tooltipClassName?: string;
  size?: number;
};

export function HelpTooltipIcon({
  content,
  ariaLabel = 'Show help information',
  className,
  iconClassName,
  tooltipClassName,
  size = 14,
}: HelpTooltipIconProps) {
  return (
    <Tooltip
      content={content}
      className={cn('z-[3600]', tooltipClassName)}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center text-secondary transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
          className,
        )}
      >
        <IoHelpCircleOutline
          size={size}
          className={iconClassName}
        />
      </button>
    </Tooltip>
  );
}
