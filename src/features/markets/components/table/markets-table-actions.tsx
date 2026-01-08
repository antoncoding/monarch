'use client';

import { ReloadIcon } from '@radix-ui/react-icons';
import { CgDisplayFullwidth } from 'react-icons/cg';
import { FiSettings } from 'react-icons/fi';
import { HiOutlineFire, HiFire } from 'react-icons/hi2';
import { TbArrowAutofitWidth } from 'react-icons/tb';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MarketFilter } from '@/features/positions/components/markets-filter-compact';
import { useModal } from '@/hooks/useModal';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import type { FlowTimeWindow } from '@/hooks/queries/useMarketMetricsQuery';

type MarketsTableActionsProps = {
  onRefresh: () => void;
  isRefetching: boolean;
  isMobile: boolean;
};

export function MarketsTableActions({ onRefresh, isRefetching, isMobile }: MarketsTableActionsProps) {
  const { open: openModal } = useModal();
  const { tableViewMode, setTableViewMode } = useMarketPreferences();
  const { trendingMode, toggleTrendingMode, trendingTimeWindow, setTrendingTimeWindow } = useMarketsFilters();
  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  return (
    <>
      <Tooltip
        content={
          <TooltipContent
            icon={<HiFire size={14} className="text-orange-500" />}
            title="Trending Markets"
            detail={trendingMode ? 'Click to show all markets' : 'Click to show only hot markets with supply inflows'}
          />
        }
      >
        <Button
          aria-label="Toggle trending mode"
          variant="ghost"
          size="sm"
          className={`min-w-0 px-2 ${trendingMode ? 'text-orange-500' : 'text-secondary'}`}
          onClick={toggleTrendingMode}
        >
          {trendingMode ? <HiFire className="h-3.5 w-3.5" /> : <HiOutlineFire className="h-3.5 w-3.5" />}
        </Button>
      </Tooltip>

      {trendingMode && (
        <Select
          value={trendingTimeWindow}
          onValueChange={(value) => setTrendingTimeWindow(value as FlowTimeWindow)}
        >
          <SelectTrigger className="h-8 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">1h</SelectItem>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7d</SelectItem>
            <SelectItem value="30d">30d</SelectItem>
          </SelectContent>
        </Select>
      )}

      <MarketFilter onOpenSettings={() => openModal('marketSettings', {})} />

      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch the latest market data"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefetching}
          className="text-secondary min-w-0 px-2"
        >
          <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
        </Button>
      </Tooltip>

      {!isMobile && (
        <Tooltip
          content={
            <TooltipContent
              icon={effectiveTableViewMode === 'compact' ? <CgDisplayFullwidth size={14} /> : <TbArrowAutofitWidth size={14} />}
              title={effectiveTableViewMode === 'compact' ? 'Full Width' : 'Responsive'}
              detail={
                effectiveTableViewMode === 'compact'
                  ? 'Table matches page layout width. Click to switch to Responsive.'
                  : 'Table adjusts width based on content. Click to switch to Full Width.'
              }
            />
          }
        >
          <Button
            aria-label="Toggle table view mode"
            variant="ghost"
            size="sm"
            className="text-secondary min-w-0 px-2"
            onClick={() => setTableViewMode(tableViewMode === 'compact' ? 'expanded' : 'compact')}
          >
            {effectiveTableViewMode === 'compact' ? (
              <CgDisplayFullwidth className="h-3 w-3" />
            ) : (
              <TbArrowAutofitWidth className="h-3 w-3" />
            )}
          </Button>
        </Tooltip>
      )}

      <Tooltip
        content={
          <TooltipContent
            title="Preferences"
            detail="Adjust thresholds and columns"
          />
        }
      >
        <Button
          aria-label="Market Preferences"
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={() => openModal('marketSettings', {})}
        >
          <FiSettings className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
  );
}
