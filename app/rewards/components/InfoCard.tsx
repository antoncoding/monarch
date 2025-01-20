import { ReactNode } from 'react';
import { Tooltip } from '@nextui-org/react';
import { BsQuestionCircle } from 'react-icons/bs';
import { Badge } from '@/components/common/Badge';
import { TooltipContent } from '@/components/TooltipContent';

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
  className?: string;
};

export default function InfoCard({
  title,
  children,
  tooltip,
  badge,
  className = '',
}: InfoCardProps) {
  return (
    <div className={`bg-surface w-full rounded-sm p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-2 pb-2 text-sm text-secondary">
        <div className="flex items-center gap-2">
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
        </div>
        {badge &&
          (badge.tooltip ? (
            <Tooltip
              content={
                <TooltipContent
                  className="max-w-[400px]"
                  title={badge.tooltip.title}
                  detail={badge.tooltip.detail}
                />
              }
              placement="top"
            >
              <div>
                <Badge variant={badge.variant ?? 'success'}>{badge.text}</Badge>
              </div>
            </Tooltip>
          ) : (
            <Badge variant={badge.variant ?? 'success'}>{badge.text}</Badge>
          ))}
      </div>
      <div className="flex items-center justify-center px-2 py-2">{children}</div>
    </div>
  );
}
