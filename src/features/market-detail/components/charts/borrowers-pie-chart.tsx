'use client';

import { useMemo, useState } from 'react';
import type { Address } from 'viem';
import { formatUnits } from 'viem';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { useChartColors } from '@/constants/chartColors';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { useAllMarketBorrowers } from '@/hooks/useAllMarketPositions';
import { formatSimple } from '@/utils/balance';
import { getSlicedAddress } from '@/utils/address';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

type BorrowersPieChartProps = {
  chainId: SupportedNetworks;
  market: Market;
  oraclePrice: bigint;
};

type PieDataItem = {
  name: string;
  value: number;
  address: string;
  percentage: number;
  collateral: number;
  ltv: number;
  isOther?: boolean;
  otherItems?: { name: string; value: number; address: string; percentage: number; collateral: number; ltv: number }[];
};

const TOP_POSITIONS_TO_SHOW = 8;
const OTHER_COLOR = '#64748B'; // Grey for "Other" category

export function BorrowersPieChart({ chainId, market, oraclePrice }: BorrowersPieChartProps) {
  const { data: borrowers, isLoading, totalCount } = useAllMarketBorrowers(market.uniqueKey, chainId);
  const { getVaultByAddress } = useVaultRegistry();
  const [expandedOther, setExpandedOther] = useState(false);
  const chartColors = useChartColors();

  // Helper to get display name for an address (vault name or shortened address)
  const getDisplayName = (address: string): string => {
    const vault = getVaultByAddress(address as Address, chainId);
    if (vault?.name) return vault.name;
    return getSlicedAddress(address as `0x${string}`);
  };

  const pieData = useMemo(() => {
    if (!borrowers || borrowers.length === 0) return [];

    const totalBorrowAssets = BigInt(market.state.borrowAssets);

    if (totalBorrowAssets === 0n) return [];

    // Calculate data for each borrower and sort by borrow value
    const borrowersWithData = borrowers
      .map((borrower) => {
        const borrowAssets = BigInt(borrower.borrowAssets);
        const collateralBigInt = BigInt(borrower.collateral);

        const borrowAssetsNumber = Number(formatUnits(borrowAssets, market.loanAsset.decimals));
        const collateralNumber = Number(formatUnits(collateralBigInt, market.collateralAsset.decimals));

        // Use scaled bigint math for precision
        const percentageScaled = (borrowAssets * 10000n) / totalBorrowAssets;
        const percentage = Number(percentageScaled) / 100;

        // Calculate LTV
        let ltv = 0;
        if (oraclePrice > 0n && collateralBigInt > 0n) {
          const collateralValueInLoan = (collateralBigInt * oraclePrice) / BigInt(10 ** 36);
          if (collateralValueInLoan > 0n) {
            ltv = Number((borrowAssets * 10000n) / collateralValueInLoan) / 100;
          }
        }

        return {
          name: getDisplayName(borrower.userAddress),
          address: borrower.userAddress,
          value: borrowAssetsNumber,
          percentage,
          collateral: collateralNumber,
          ltv,
        };
      })
      .sort((a, b) => b.value - a.value);

    // Split into top positions and "Other" - always show top 8 regardless of percentage
    const topPositions: PieDataItem[] = [];
    const otherPositions: {
      name: string;
      value: number;
      address: string;
      percentage: number;
      collateral: number;
      ltv: number;
    }[] = [];

    for (let i = 0; i < borrowersWithData.length; i++) {
      if (i < TOP_POSITIONS_TO_SHOW) {
        topPositions.push(borrowersWithData[i]);
      } else {
        otherPositions.push(borrowersWithData[i]);
      }
    }

    // Calculate "Other" as everything NOT in topPositions (including positions beyond top 100)
    // This correctly accounts for all positions, not just the ones we fetched
    const top8TotalPercentage = topPositions.reduce((sum, p) => sum + p.percentage, 0);
    const otherPercentage = 100 - top8TotalPercentage;

    // For absolute value, use market total minus top 8
    const totalBorrowValue = Number(formatUnits(totalBorrowAssets, market.loanAsset.decimals));
    const top8TotalValue = topPositions.reduce((sum, p) => sum + p.value, 0);
    const otherValue = totalBorrowValue - top8TotalValue;

    // Only add "Other" if there's meaningful remainder
    if (otherPercentage > 0.01) {
      const otherCollateral = otherPositions.reduce((sum, p) => sum + p.collateral, 0);

      topPositions.push({
        name: 'Other',
        address: 'other',
        value: otherValue,
        percentage: otherPercentage,
        collateral: otherCollateral,
        ltv: 0,
        isOther: true,
        otherItems: otherPositions, // Only contains positions 9-100, but percentage/value are correct
      });
    }

    return topPositions;
  }, [borrowers, market, oraclePrice, getDisplayName]);

  const handlePieClick = (data: PieDataItem) => {
    if (data.isOther) {
      setExpandedOther(!expandedOther);
    }
  };

  // Extract the "Other" entry once for use in expanded section
  const otherEntry = useMemo(() => pieData.find((d) => d.isOther), [pieData]);

  // Format percentage display (matches table)
  const formatPercentDisplay = (percent: number): string => {
    if (percent < 0.01 && percent > 0) return '<0.01%';
    return `${percent.toFixed(2)}%`;
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: PieDataItem }[] }) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-1 font-medium text-sm">{data.name}</p>
        {!data.isOther && <p className="mb-2 font-mono text-xs text-secondary">{getSlicedAddress(data.address as `0x${string}`)}</p>}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-secondary">Borrowed</span>
            <div className="flex items-center gap-1 tabular-nums">
              <span>{formatSimple(data.value)}</span>
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={14}
                height={14}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-secondary">Collateral</span>
            <div className="flex items-center gap-1 tabular-nums">
              <span>{formatSimple(data.collateral)}</span>
              <TokenIcon
                address={market.collateralAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.collateralAsset.symbol}
                width={14}
                height={14}
              />
            </div>
          </div>
          {!data.isOther && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-secondary">LTV</span>
              <span className="tabular-nums">{data.ltv.toFixed(2)}%</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-secondary">% of Borrow</span>
            <span className="tabular-nums">{formatPercentDisplay(data.percentage)}</span>
          </div>
        </div>
        {data.isOther && <p className="mt-2 text-xs text-secondary">Click to {expandedOther ? 'collapse' : 'expand'}</p>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="flex h-[350px] items-center justify-center border border-border bg-surface">
        <Spinner size={24} />
      </Card>
    );
  }

  if (pieData.length === 0) {
    return (
      <Card className="flex h-[350px] items-center justify-center border border-border bg-surface">
        <p className="text-secondary">No borrowers found</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg text-secondary">Borrow Distribution</h4>
          <span className="text-xs text-secondary">{totalCount} borrowers</span>
        </div>
      </div>

      <div className="px-4 py-4">
        <ResponsiveContainer
          width="100%"
          height={280}
        >
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              onClick={(_, index) => handlePieClick(pieData[index])}
              style={{ cursor: 'pointer' }}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.address}`}
                  fill={entry.isOther ? OTHER_COLOR : chartColors.pie[index % chartColors.pie.length]}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingLeft: '12px', maxWidth: '45%' }}
              formatter={(value) => (
                <span
                  className="text-secondary"
                  style={{ display: 'inline-block', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Expanded "Other" section */}
      {expandedOther && otherEntry?.otherItems && (
        <div className="border-t border-border/40 px-6 py-4">
          <h5 className="mb-3 text-sm text-secondary">Other Borrowers</h5>
          <div className="max-h-[200px] overflow-y-auto">
            <div className="grid gap-2">
              {otherEntry.otherItems.slice(0, 20).map((item) => (
                <div
                  key={item.address}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-secondary">{item.name}</span>
                  <span className="tabular-nums">
                    {formatSimple(item.value)} ({formatPercentDisplay(item.percentage)})
                  </span>
                </div>
              ))}
              {otherEntry.otherItems.length > 20 && (
                <p className="text-center text-xs text-secondary">And {otherEntry.otherItems.length - 20} more...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
