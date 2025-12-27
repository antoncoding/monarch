import { useMemo, useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { ReloadIcon } from '@radix-ui/react-icons';
import { CgCompress } from 'react-icons/cg';
import { FiSettings } from 'react-icons/fi';
import { RiExpandHorizontalLine } from 'react-icons/ri';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { SuppliedAssetFilterCompactSwitch } from '@/features/positions/components/supplied-asset-filter-compact-switch';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import { SortColumn } from '../constants';
import { MarketTableBody } from './market-table-body';
import { HTSortable } from './market-table-utils';

type MarketsTableProps = {
  sortColumn: number;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  markets: Market[];
  staredIds: string[];
  unstarMarket: (id: string) => void;
  starMarket: (id: string) => void;
  currentPage: number;
  entriesPerPage: number;
  setCurrentPage: (value: number) => void;
  trustedVaults: TrustedVault[];
  className?: string;
  wrapperClassName?: string;
  tableClassName?: string;
  addBlacklistedMarket?: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  isBlacklisted?: (uniqueKey: string) => boolean;
  // Settings props
  includeUnknownTokens: boolean;
  setIncludeUnknownTokens: (value: boolean) => void;
  showUnknownOracle: boolean;
  setShowUnknownOracle: (value: boolean) => void;
  showUnwhitelistedMarkets: boolean;
  setShowUnwhitelistedMarkets: (value: boolean) => void;
  trustedVaultsOnly: boolean;
  setTrustedVaultsOnly: (value: boolean) => void;
  minSupplyEnabled: boolean;
  setMinSupplyEnabled: (value: boolean) => void;
  minBorrowEnabled: boolean;
  setMinBorrowEnabled: (value: boolean) => void;
  minLiquidityEnabled: boolean;
  setMinLiquidityEnabled: (value: boolean) => void;
  thresholds: {
    minSupply: number;
    minBorrow: number;
    minLiquidity: number;
  };
  onOpenSettings: () => void;
  onRefresh: () => void;
  isRefetching: boolean;
  tableViewMode: 'compact' | 'expanded';
  setTableViewMode: (mode: 'compact' | 'expanded') => void;
  isMobile: boolean;
};

function MarketsTable({
  staredIds,
  sortColumn,
  titleOnclick,
  sortDirection,
  markets,
  starMarket,
  unstarMarket,
  currentPage,
  entriesPerPage,
  setCurrentPage,
  trustedVaults,
  className,
  wrapperClassName,
  tableClassName,
  addBlacklistedMarket,
  isBlacklisted,
  includeUnknownTokens,
  setIncludeUnknownTokens,
  showUnknownOracle,
  setShowUnknownOracle,
  showUnwhitelistedMarkets,
  setShowUnwhitelistedMarkets,
  trustedVaultsOnly,
  setTrustedVaultsOnly,
  minSupplyEnabled,
  setMinSupplyEnabled,
  minBorrowEnabled,
  setMinBorrowEnabled,
  minLiquidityEnabled,
  setMinLiquidityEnabled,
  thresholds,
  onOpenSettings,
  onRefresh,
  isRefetching,
  tableViewMode,
  setTableViewMode,
  isMobile,
}: MarketsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });

  const { columnVisibility } = useMarketPreferences();

  const trustedVaultMap = useMemo(() => buildTrustedVaultMap(trustedVaults), [trustedVaults]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = markets.slice(indexOfFirstEntry, indexOfLastEntry);

  const totalPages = Math.ceil(markets.length / entriesPerPage);

  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  const containerClassName = ['flex flex-col gap-2 pb-4', className].filter((value): value is string => Boolean(value)).join(' ');
  const tableClassNames = ['responsive', tableClassName].filter((value): value is string => Boolean(value)).join(' ');

  // Header actions (filter, refresh, expand/compact, settings)
  const headerActions = (
    <>
      <SuppliedAssetFilterCompactSwitch
        includeUnknownTokens={includeUnknownTokens}
        setIncludeUnknownTokens={setIncludeUnknownTokens}
        showUnknownOracle={showUnknownOracle}
        setShowUnknownOracle={setShowUnknownOracle}
        showUnwhitelistedMarkets={showUnwhitelistedMarkets}
        setShowUnwhitelistedMarkets={setShowUnwhitelistedMarkets}
        trustedVaultsOnly={trustedVaultsOnly}
        setTrustedVaultsOnly={setTrustedVaultsOnly}
        minSupplyEnabled={minSupplyEnabled}
        setMinSupplyEnabled={setMinSupplyEnabled}
        minBorrowEnabled={minBorrowEnabled}
        setMinBorrowEnabled={setMinBorrowEnabled}
        minLiquidityEnabled={minLiquidityEnabled}
        setMinLiquidityEnabled={setMinLiquidityEnabled}
        thresholds={thresholds}
        onOpenSettings={onOpenSettings}
      />

      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch the latest market data"
          />
        }
      >
        <span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefetching}
            className="text-secondary min-w-0 px-2"
          >
            <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
          </Button>
        </span>
      </Tooltip>

      {/* Hide expand/compact toggle on mobile */}
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
          <span>
            <Button
              aria-label="Toggle table width"
              variant="ghost"
              size="sm"
              className="text-secondary min-w-0 px-2"
              onClick={() => setTableViewMode(tableViewMode === 'compact' ? 'expanded' : 'compact')}
            >
              {effectiveTableViewMode === 'compact' ? <RiExpandHorizontalLine className="h-3 w-3" /> : <CgCompress className="h-3 w-3" />}
            </Button>
          </span>
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
        <span>
          <Button
            aria-label="Market Preferences"
            variant="ghost"
            size="sm"
            className="text-secondary min-w-0 px-2"
            onClick={onOpenSettings}
          >
            <FiSettings className="h-3 w-3" />
          </Button>
        </span>
      </Tooltip>
    </>
  );

  return (
    <div className={containerClassName}>
      <TableContainerWithHeader
        title=""
        actions={headerActions}
      >
        <Table className={tableClassNames}>
          <TableHeader>
            <TableRow>
              <HTSortable
                label={sortColumn === 0 ? <FaStar /> : <FaRegStar />}
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.Starred}
                showDirection={false}
              />
              <TableHead className="font-normal px-2 py-2 whitespace-nowrap"> Id </TableHead>
              <HTSortable
                label="Loan"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.LoanAsset}
              />
              <HTSortable
                label="Collateral"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.CollateralAsset}
              />
              <TableHead className="font-normal px-2 py-2 whitespace-nowrap">Oracle</TableHead>
              <HTSortable
                label="LLTV"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.LLTV}
              />
              {columnVisibility.trustedBy && (
                <HTSortable
                  label="Trusted By"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.TrustedBy}
                />
              )}
              {columnVisibility.totalSupply && (
                <HTSortable
                  label="Total Supply"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.Supply}
                />
              )}
              {columnVisibility.totalBorrow && (
                <HTSortable
                  label="Total Borrow"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.Borrow}
                />
              )}
              {columnVisibility.liquidity && (
                <HTSortable
                  label="Liquidity"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.Liquidity}
                />
              )}
              {columnVisibility.supplyAPY && (
                <HTSortable
                  label={supplyRateLabel}
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.SupplyAPY}
                />
              )}
              {columnVisibility.borrowAPY && (
                <HTSortable
                  label={borrowRateLabel}
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.BorrowAPY}
                />
              )}
              {columnVisibility.rateAtTarget && (
                <HTSortable
                  label="Target Rate"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.RateAtTarget}
                />
              )}
              {columnVisibility.utilizationRate && (
                <HTSortable
                  label="Utilization"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.UtilizationRate}
                />
              )}
              <TableHead
                className="font-normal px-2 py-2 whitespace-nowrap"
                style={{ padding: '0.35rem 0.8rem' }}
              >
                {' '}
                Risk{' '}
              </TableHead>
              <TableHead
                className="font-normal px-2 py-2 whitespace-nowrap"
                style={{ padding: '0.35rem 0.8rem' }}
              >
                {' '}
                Indicators{' '}
              </TableHead>
              <TableHead
                className="font-normal px-2 py-2 whitespace-nowrap"
                style={{ padding: '0.35rem 0.8rem' }}
              >
                {' '}
                Actions{' '}
              </TableHead>
            </TableRow>
          </TableHeader>
          <MarketTableBody
            currentEntries={currentEntries}
            staredIds={staredIds}
            expandedRowId={expandedRowId}
            setExpandedRowId={setExpandedRowId}
            starMarket={starMarket}
            unstarMarket={unstarMarket}
            trustedVaultMap={trustedVaultMap}
            addBlacklistedMarket={addBlacklistedMarket}
            isBlacklisted={isBlacklisted}
          />
        </Table>
      </TableContainerWithHeader>
      <TablePagination
        totalPages={totalPages}
        totalEntries={markets.length}
        currentPage={currentPage}
        pageSize={entriesPerPage}
        onPageChange={setCurrentPage}
        isLoading={false}
        showEntryCount={false}
      />
    </div>
  );
}

export default MarketsTable;
