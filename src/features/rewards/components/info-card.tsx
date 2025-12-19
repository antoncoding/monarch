import type { ReactNode } from 'react';
import { Tooltip } from '@heroui/react';
import { BsQuestionCircle } from 'react-icons/bs';
import { Badge } from '@/components/ui/badge';
import { TooltipContent } from '@/components/shared/tooltip-content';

type TooltipInfo = {
  title: string;
  detail: string;
};

type InfoCardProps = {
  title: string;
  children: ReactNode;
  tooltip?: TooltipInfo;
  badge?: {
    text: string;
    tooltip?: TooltipInfo;
    variant?: 'success' | 'warning' | 'danger' | 'primary' | 'default';
  };
  button?: {
    text: string;
    onClick: () => void;
    tooltip?: TooltipInfo;
    variant?: 'success' | 'warning' | 'danger' | 'primary' | 'default';
    disabled?: boolean;
  };
  className?: string;
};

function BadgeButton({
  text,
  variant,
  disabled,
  handleClick,
  tooltip,
}: {
  text: string;
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'default';
  disabled?: boolean;
  handleClick: () => void;
  tooltip?: TooltipInfo;
}) {
  const ButtonComponent = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Badge variant={variant ?? 'success'}>{text}</Badge>
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip
        content={
          <TooltipContent
            className="max-w-[400px]"
            title={tooltip.title}
            detail={tooltip.detail}
          />
        }
        placement="top"
      >
        {ButtonComponent}
      </Tooltip>
    );
  }

  return ButtonComponent;
}

function BadgeComponent({
  text,
  variant,
  tooltip,
}: {
  text: string;
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'default';
  tooltip?: TooltipInfo;
}) {
  const BadgeElement = <Badge variant={variant ?? 'success'}>{text}</Badge>;

  if (tooltip) {
    return (
      <Tooltip
        content={
          <TooltipContent
            className="max-w-[400px]"
            title={tooltip.title}
            detail={tooltip.detail}
          />
        }
        placement="top"
      >
        <div>{BadgeElement}</div>
      </Tooltip>
    );
  }

  return BadgeElement;
}

export default function InfoCard({ title, children, tooltip, badge, button, className = '' }: InfoCardProps) {
  return (
    <div className={`bg-surface w-full rounded-sm p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-2 pb-2 text-sm text-secondary">
        <div className="flex items-center gap-2">
          <span className="leading-none">{title}</span>
          {tooltip && (
            <Tooltip
              content={
                <TooltipContent
                  className="max-w-[400px]"
                  title={tooltip.title}
                  detail={tooltip.detail}
                />
              }
              placement="right"
            >
              <div className="flex items-center">
                <BsQuestionCircle className="cursor-help text-secondary" />
              </div>
            </Tooltip>
          )}
        </div>
        <div>
          {button ? (
            <BadgeButton
              text={button.text}
              variant={button.variant}
              disabled={button.disabled}
              handleClick={button.onClick}
              tooltip={button.tooltip}
            />
          ) : badge ? (
            <BadgeComponent
              text={badge.text}
              variant={badge.variant}
              tooltip={badge.tooltip}
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-center px-2 py-2">{children}</div>
    </div>
  );
}
