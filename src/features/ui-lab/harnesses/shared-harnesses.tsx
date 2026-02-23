'use client';

import { useMemo, useState } from 'react';
import { IoMdCheckmarkCircleOutline } from 'react-icons/io';
import { LuArrowRightLeft, LuLayoutGrid, LuMoon, LuRefreshCw, LuSun } from 'react-icons/lu';
import { SectionTag } from '@/components/landing/SectionTag';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TablePagination } from '@/components/shared/table-pagination';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconSwitch } from '@/components/ui/icon-switch';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CollateralIconsDisplay } from '@/features/positions/components/collateral-icons-display';
import {
  uiLabAccountAddressFixtures,
  uiLabCollateralFixtures,
  uiLabTransactionHashFixtures,
} from '@/features/ui-lab/fixtures/component-fixtures';
import { useStyledToast } from '@/hooks/useStyledToast';
import { SupportedNetworks } from '@/utils/networks';

export function AccountIdentityHarness(): JSX.Element {
  const [primaryAddress, secondaryAddress] = uiLabAccountAddressFixtures;

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-secondary">Badge</p>
        <AccountIdentity
          address={primaryAddress}
          chainId={SupportedNetworks.Mainnet}
          variant="badge"
          showActions={false}
          showCopy
          linkTo="explorer"
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-secondary">Compact</p>
        <AccountIdentity
          address={secondaryAddress}
          chainId={SupportedNetworks.Mainnet}
          variant="compact"
          showActions={false}
          showCopy
          linkTo="profile"
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-secondary">Full</p>
        <AccountIdentity
          address={primaryAddress}
          chainId={SupportedNetworks.Mainnet}
          variant="full"
          showAddress
          showActions={false}
          linkTo="explorer"
        />
      </div>
    </div>
  );
}

export function TransactionIdentityHarness(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TransactionIdentity
        txHash={uiLabTransactionHashFixtures[0]}
        chainId={SupportedNetworks.Mainnet}
      />
      <TransactionIdentity
        txHash={uiLabTransactionHashFixtures[1]}
        chainId={SupportedNetworks.Mainnet}
        showFullHash
      />
    </div>
  );
}

export function CollateralIconsDisplayHarness(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-secondary">Compact</p>
        <CollateralIconsDisplay
          collaterals={uiLabCollateralFixtures.slice(0, 3)}
          chainId={SupportedNetworks.Mainnet}
          maxDisplay={8}
          iconSize={20}
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-secondary">Overflow + Tooltip</p>
        <CollateralIconsDisplay
          collaterals={uiLabCollateralFixtures}
          chainId={SupportedNetworks.Mainnet}
          maxDisplay={4}
          iconSize={22}
        />
      </div>
    </div>
  );
}

export function SectionTagHarness(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SectionTag>Market Snapshot</SectionTag>
      <SectionTag>Risk Controls</SectionTag>
      <SectionTag>Execution Layer</SectionTag>
    </div>
  );
}

export function IconSwitchHarness(): JSX.Element {
  const [plainEnabled, setPlainEnabled] = useState(true);
  const [modeEnabled, setModeEnabled] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-secondary">Plain switch</p>
        <IconSwitch
          size="sm"
          selected={plainEnabled}
          onChange={setPlainEnabled}
          thumbIcon={null}
        />
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm text-secondary">Icon switch</p>
        <IconSwitch
          size="md"
          selected={modeEnabled}
          onChange={setModeEnabled}
          thumbIconOn={LuSun}
          thumbIconOff={LuMoon}
        />
      </div>
    </div>
  );
}

export function RefetchIconHarness(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  const triggerRefresh = () => {
    if (isLoading) return;
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="surface"
        size="sm"
        onClick={triggerRefresh}
        disabled={isLoading}
      >
        <RefetchIcon
          isLoading={isLoading}
          className="h-4 w-4"
        />
        {isLoading ? 'Refreshing' : 'Refresh'}
      </Button>
      <p className="text-sm text-secondary">The icon completes the active spin cycle before stopping.</p>
    </div>
  );
}

export function DropdownMenuHarness(): JSX.Element {
  const [showRiskSignals, setShowRiskSignals] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="surface"
            size="sm"
          >
            Open Menu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem startContent={<LuRefreshCw className="h-4 w-4" />}>Refresh</DropdownMenuItem>
          <DropdownMenuItem startContent={<IoMdCheckmarkCircleOutline className="h-4 w-4" />}>Mark as reviewed</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={showRiskSignals}
            onCheckedChange={(checked) => setShowRiskSignals(checked === true)}
          >
            Show risk signals
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={viewMode}
            onValueChange={(value) => setViewMode(value as 'table' | 'cards')}
          >
            <DropdownMenuRadioItem
              value="table"
              startContent={<LuArrowRightLeft className="h-4 w-4" />}
            >
              Table layout
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value="cards"
              startContent={<LuLayoutGrid className="h-4 w-4" />}
            >
              Card layout
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <p className="text-sm text-secondary">
        Current: {viewMode} / {showRiskSignals ? 'risk on' : 'risk off'}
      </p>
    </div>
  );
}

export function TableContainerWithHeaderHarness(): JSX.Element {
  const rows = useMemo(
    () => [
      { market: 'USDC / WETH', supplied: '$125,000', borrowed: '$74,250' },
      { market: 'USDT / WBTC', supplied: '$93,200', borrowed: '$48,100' },
      { market: 'WBTC / WETH', supplied: '$212,000', borrowed: '$112,000' },
    ],
    [],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 900);
  };

  return (
    <TableContainerWithHeader
      title="Market Activity"
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefetchIcon
              isLoading={isRefreshing}
              className="h-4 w-4"
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
              >
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Top liquidity</DropdownMenuItem>
              <DropdownMenuItem>Top borrow rate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Market</TableHead>
            <TableHead className="text-right">Supplied</TableHead>
            <TableHead className="text-right">Borrowed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="table-body-compact">
          {rows.map((row) => (
            <TableRow key={row.market}>
              <TableCell>{row.market}</TableCell>
              <TableCell className="text-right">{row.supplied}</TableCell>
              <TableCell className="text-right">{row.borrowed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainerWithHeader>
  );
}

export function TablePaginationHarness(): JSX.Element {
  const totalEntries = 248;
  const pageSize = 25;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const [page, setPage] = useState(1);

  return (
    <TablePagination
      currentPage={page}
      totalPages={totalPages}
      totalEntries={totalEntries}
      pageSize={pageSize}
      onPageChange={setPage}
      isLoading={false}
    />
  );
}

export function ToastHarness(): JSX.Element {
  const { success, error, info } = useStyledToast();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="surface"
        size="sm"
        onClick={() => success('Allocation complete', '2.5M USDC was allocated across 3 markets.')}
      >
        Success Toast
      </Button>
      <Button
        variant="surface"
        size="sm"
        onClick={() => error('Transaction reverted', 'Slippage exceeded the configured tolerance.')}
      >
        Error Toast
      </Button>
      <Button
        variant="surface"
        size="sm"
        onClick={() => info('Rebalance queued', 'Execution will start after block confirmation.')}
      >
        Info Toast
      </Button>
    </div>
  );
}
