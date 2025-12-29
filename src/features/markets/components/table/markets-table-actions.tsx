'use client';

import { ReloadIcon } from '@radix-ui/react-icons';
import { CgCompress } from 'react-icons/cg';
import { FiSettings } from 'react-icons/fi';
import { RiExpandHorizontalLine } from 'react-icons/ri';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { SuppliedAssetFilterCompactSwitch } from '@/features/positions/components/supplied-asset-filter-compact-switch';
import { useModal } from '@/hooks/useModal';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

type MarketsTableActionsProps = {
  onRefresh: () => void;
  isRefetching: boolean;
  isMobile: boolean;
};

export function MarketsTableActions({ onRefresh, isRefetching, isMobile }: MarketsTableActionsProps) {
  const { open: openModal } = useModal();
  const { tableViewMode, setTableViewMode } = useMarketPreferences();
  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  return (
    <>
      <SuppliedAssetFilterCompactSwitch onOpenSettings={() => openModal('marketSettings', {})} />

      <Tooltip
        content={<TooltipContent title="Refresh" detail="Fetch the latest market data" />}
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
              icon={effectiveTableViewMode === 'compact' ? <RiExpandHorizontalLine size={14} /> : <CgCompress size={14} />}
              title={effectiveTableViewMode === 'compact' ? 'Expand Table' : 'Compact Table'}
              detail={
                effectiveTableViewMode === 'compact'
                  ? 'Expand table to full width, useful when more columns are enabled.'
                  : 'Restore compact table view'
              }
            />
          }
        >
          <Button
            aria-label="Toggle table width"
            variant="ghost"
            size="sm"
            className="text-secondary min-w-0 px-2"
            onClick={() => setTableViewMode(tableViewMode === 'compact' ? 'expanded' : 'compact')}
          >
            {effectiveTableViewMode === 'compact' ? <RiExpandHorizontalLine className="h-3 w-3" /> : <CgCompress className="h-3 w-3" />}
          </Button>
        </Tooltip>
      )}

      <Tooltip
        content={<TooltipContent title="Preferences" detail="Adjust thresholds and columns" />}
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
