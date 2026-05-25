import type { MouseEvent, ReactNode } from 'react';

type TooltipContentProps = {
  icon?: ReactNode;
  title?: ReactNode;
  detail?: ReactNode;
  secondaryDetail?: ReactNode;
  footer?: ReactNode;
  className?: string;
  actionIcon?: ReactNode;
  actionHref?: string;
  onActionClick?: (e: MouseEvent) => void;
};

export function TooltipContent({
  icon,
  title,
  detail,
  secondaryDetail,
  footer,
  className = '',
  actionIcon,
  actionHref,
  onActionClick,
}: TooltipContentProps) {
  const contentClassName = `max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden break-words ${className}`;

  // Simple tooltip with just an icon and title
  if (!detail && !secondaryDetail && !footer) {
    return (
      <div className={`flex items-center gap-2 ${contentClassName}`}>
        {icon && <div className="flex items-center">{icon}</div>}
        <span className="min-w-0 font-zen text-primary">{title}</span>
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
    <div className={contentClassName}>
      <div className="flex w-full gap-3">
        {icon && <div className="flex-shrink-0 self-center">{icon}</div>}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {title && <div className="font-zen text-primary">{title}</div>}
          {detail && <div className="whitespace-pre-line font-zen text-sm text-primary">{detail}</div>}
          {secondaryDetail && <div className="whitespace-pre-line font-zen text-xs text-secondary">{secondaryDetail}</div>}
          {footer}
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
