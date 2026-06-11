import { cn } from '@/utils';

const CHART_GRID_LINES = ['top-[24%]', 'top-[42%]', 'top-[60%]', 'top-[78%]'] as const;
const CHART_COLUMNS = ['left-[22%]', 'left-[40%]', 'left-[58%]', 'left-[76%]'] as const;

type AdminChartLoadingStateProps = {
  className?: string;
};

export function AdminChartLoadingState({ className }: AdminChartLoadingStateProps) {
  return (
    <div
      className={cn('relative overflow-hidden px-6 py-5', className)}
      role="status"
      aria-label="Loading chart data"
    >
      {CHART_GRID_LINES.map((lineClass) => (
        <span
          key={lineClass}
          className={cn('absolute right-6 left-6 h-px bg-border/50', lineClass)}
        />
      ))}
      {CHART_COLUMNS.map((lineClass) => (
        <span
          key={lineClass}
          className={cn('absolute top-5 bottom-8 w-px bg-border/30', lineClass)}
        />
      ))}
      <div className="absolute right-6 bottom-8 left-6 h-24 rounded-sm bg-hovered/40" />
      <div className="absolute right-16 bottom-8 left-12 h-36 rounded-sm bg-hovered/70" />
      <div className="absolute right-8 bottom-8 left-[44%] h-16 rounded-sm bg-hovered/50" />
      <span className="sr-only">Loading chart data</span>
    </div>
  );
}
