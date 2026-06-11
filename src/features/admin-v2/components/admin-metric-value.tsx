import { cn } from '@/utils';

type AdminMetricValueProps = {
  value: string;
  isLoading?: boolean;
  className?: string;
  skeletonClassName?: string;
  style?: React.CSSProperties;
};

export function AdminMetricValue({ value, isLoading, className, skeletonClassName, style }: AdminMetricValueProps) {
  if (isLoading) {
    return (
      <span
        className={cn('inline-block h-5 w-24 rounded-sm bg-hovered', skeletonClassName)}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn('font-normal tabular-nums', className)}
      style={style}
    >
      {value}
    </span>
  );
}
