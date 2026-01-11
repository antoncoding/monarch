'use client';

import moment from 'moment';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { CgDisplayFullwidth } from 'react-icons/cg';
import { FiSettings } from 'react-icons/fi';
import { TbArrowAutofitWidth } from 'react-icons/tb';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MarketFilter } from '@/features/positions/components/markets-filter-compact';
import { useModal } from '@/hooks/useModal';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

type MarketsTableActionsProps = {
  onRefresh: () => void;
  isRefetching: boolean;
  isMobile: boolean;
  dataUpdatedAt: number;
};

export function MarketsTableActions({ onRefresh, isRefetching, isMobile, dataUpdatedAt }: MarketsTableActionsProps) {
  const { open: openModal } = useModal();
  const { tableViewMode, setTableViewMode } = useMarketPreferences();
  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  return (
    <>
      {dataUpdatedAt !== 0 && (
        <Tooltip
          content={
            <TooltipContent
              title="Last updated"
              detail={`${moment(dataUpdatedAt).format('h:mm:ss A')} (${moment(dataUpdatedAt).fromNow()})`}
            />
          }
        >
          <span className="text-xs text-secondary whitespace-nowrap cursor-default">{moment(dataUpdatedAt).format('h:mm:ss A')}</span>
        </Tooltip>
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
          <RefetchIcon isLoading={isRefetching} />
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
