import { Button } from '@/components/ui/button';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';

type PreviewSectionHeaderProps = {
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function PreviewSectionHeader({ title, onRefresh, isRefreshing = false }: PreviewSectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="font-monospace text-xs uppercase tracking-[0.14em] text-secondary">{title}</p>
      {onRefresh && (
        <Tooltip
          content={
            <TooltipContent
              title="Refresh"
              detail="Refresh preview values"
            />
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 min-w-0 px-2 text-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={`Refresh ${title}`}
          >
            <RefetchIcon isLoading={isRefreshing} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
