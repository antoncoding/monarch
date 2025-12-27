import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { ReloadIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useTokens } from '@/components/providers/TokenProvider';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { parseCapIdParams } from '@/utils/morpho';
import { convertApyToApr } from '@/utils/rateMath';
import { VaultAllocationDetail } from './vault-allocation-detail';
import { CollateralIconsDisplay } from './collateral-icons-display';
import { VaultActionsDropdown } from './vault-actions-dropdown';
import { AggregatedVaultRiskIndicators } from './vault-risk-indicators';

type UserVaultsTableProps = {
  vaults: UserVaultV2[];
  account: string;
  refetch?: () => void;
  isRefetching?: boolean;
};

export function UserVaultsTable({ vaults, account, refetch, isRefetching = false }: UserVaultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { findToken } = useTokens();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  if (vaults.length === 0) {
    return null;
  }

  // Header actions (refresh button)
  const headerActions = refetch ? (
    <Tooltip
      content={
        <TooltipContent
          title="Refresh"
          detail="Fetch latest vault data"
        />
      }
    >
      <span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          disabled={isRefetching}
          className="text-secondary min-w-0 px-2"
        >
          <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
        </Button>
      </span>
    </Tooltip>
  ) : undefined;

  return (
    <div className="space-y-4 overflow-x-auto">
      <TableContainerWithHeader
        title="Auto Vaults"
        actions={headerActions}
      >
        <Table className="responsive w-full min-w-[640px]">
          <TableHeader>
            <TableRow className="w-full justify-center text-secondary">
              <TableHead className="w-10">Network</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>{rateLabel} (now)</TableHead>
              <TableHead>Interest Accrued</TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead>Risk Tiers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {vaults.map((vault) => {
              const rowKey = `${vault.address}-${vault.networkId}`;
              const isExpanded = expandedRows.has(rowKey);
              const token = findToken(vault.asset, vault.networkId);
              const networkImg = getNetworkImg(vault.networkId);

              // Extract unique collateral addresses from caps
              const collateralAddresses = vault.caps
                .map((cap) => parseCapIdParams(cap.idParams).collateralToken)
                .filter((collat) => collat !== undefined);

              const uniqueCollateralAddresses = Array.from(new Set(collateralAddresses));

              // Transform to format expected by CollateralIconsDisplay
              const collaterals = uniqueCollateralAddresses
                .map((address) => {
                  const collateralToken = findToken(address, vault.networkId);
                  return {
                    address,
                    symbol: collateralToken?.symbol ?? 'Unknown',
                    amount: 1, // Use 1 as placeholder since we're just showing presence
                  };
                })
                .filter((c) => c !== null);

              const avgApy = vault.avgApy;
              const displayRate = avgApy !== null && avgApy !== undefined && isAprDisplay ? convertApyToApr(avgApy) : avgApy;

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(rowKey)}
                  >
                    {/* Network */}
                    <TableCell className="w-10">
                      <div className="flex items-center justify-center">
                        {networkImg && (
                          <Image
                            src={networkImg}
                            alt={`Chain ${vault.networkId}`}
                            width={24}
                            height={24}
                          />
                        )}
                      </div>
                    </TableCell>

                    {/* Size */}
                    <TableCell data-label="Size">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">
                          {vault.balance && token ? formatReadable(formatUnits(vault.balance, token.decimals)) : '0'}
                        </span>
                        <span>{token?.symbol ?? 'USDC'}</span>
                        <TokenIcon
                          address={vault.asset}
                          chainId={vault.networkId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>

                    {/* APY/APR */}
                    <TableCell data-label={`${rateLabel} (now)`}>
                      <div className="flex items-center justify-center">
                        <span className="font-medium">
                          {displayRate !== null && displayRate !== undefined ? `${(displayRate * 100).toFixed(2)}%` : '—'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Interest Accrued - TODO: implement vault earnings calculation */}
                    <TableCell data-label="Interest Accrued">
                      <div className="flex items-center justify-center">
                        <span className="font-medium">-</span>
                      </div>
                    </TableCell>

                    {/* Collateral */}
                    <TableCell data-label="Collateral">
                      <CollateralIconsDisplay
                        collaterals={collaterals}
                        chainId={vault.networkId}
                        maxDisplay={5}
                        iconSize={20}
                      />
                    </TableCell>

                    {/* Risk Tiers */}
                    <TableCell
                      data-label="Risk Tiers"
                      className="align-middle"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <AggregatedVaultRiskIndicators vault={vault} />
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell data-label="Actions">
                      <div className="flex justify-center">
                        <VaultActionsDropdown
                          vaultAddress={vault.address}
                          chainId={vault.networkId}
                          account={account}
                        />
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded allocation detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <TableRow className="bg-surface [&:hover]:border-transparent [&:hover]:bg-surface">
                        <TableCell
                          colSpan={7}
                          className="bg-surface"
                        >
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            transition={{ duration: 0.1 }}
                            className="overflow-hidden"
                          >
                            <VaultAllocationDetail vault={vault} />
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainerWithHeader>
    </div>
  );
}
