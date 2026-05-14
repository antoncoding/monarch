'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { AccountActionsPopover } from '@/components/shared/account-actions-popover';
import useUserPositionsSummaryData, { type EarningsPeriod } from '@/hooks/useUserPositionsSummaryData';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import type { SupportedNetworks } from '@/utils/networks';
import { hasSupplyPositionHistory } from '@/utils/positions';
import { formatVaultAdapterType } from '@/utils/vaults';
import { BorrowedMorphoBlueTable } from './borrowed-morpho-blue-table';
import { SuppliedMorphoBlueGroupedTable } from './supplied-morpho-blue-grouped-table';

type AdapterExposureDescriptor = {
  address: Address;
  adapterType?: string;
};

type VaultManagedExposuresProps = {
  fallbackAdapterAddress?: Address;
  fallbackAdapterType?: string;
  chainId: number;
  period: EarningsPeriod;
  vaultAddress: Address;
};

type AdapterExposureProps = {
  adapterAddress: Address;
  adapterType?: string;
  chainId: number;
  period: EarningsPeriod;
};

function AdapterIdentityChip({ adapterAddress, adapterType, chainId }: Omit<AdapterExposureProps, 'period'>) {
  const label = formatVaultAdapterType(adapterType);

  return (
    <AccountActionsPopover
      address={adapterAddress}
      chainId={chainId}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center rounded-sm border-0 bg-hovered px-2 py-1 text-xs text-secondary transition-colors hover:text-primary"
        aria-label={`Open actions for ${label}`}
      >
        {label}
      </button>
    </AccountActionsPopover>
  );
}

function AdapterExposure({ adapterAddress, adapterType, chainId, period }: AdapterExposureProps) {
  const chainIds = useMemo(() => [chainId as SupportedNetworks], [chainId]);

  const { isPositionsLoading, positions, refetch, isRefetching, isEarningsLoading, actualBlockData, transactions, snapshotsByChain } =
    useUserPositionsSummaryData(adapterAddress, period, chainIds);

  const hasSuppliedMarkets = positions.some(hasSupplyPositionHistory);
  const hasBorrowPositions = positions.some(
    (position) => BigInt(position.state.borrowShares) > 0n || BigInt(position.state.collateral) > 0n,
  );
  const showEmpty = !isPositionsLoading && !hasSuppliedMarkets && !hasBorrowPositions;

  return (
    <div className="space-y-3">
      <AdapterIdentityChip
        adapterAddress={adapterAddress}
        adapterType={adapterType}
        chainId={chainId}
      />

      {isPositionsLoading && <div className="rounded bg-surface px-4 py-6 text-sm text-secondary shadow-sm">Loading...</div>}

      {!isPositionsLoading && hasSuppliedMarkets && (
        <SuppliedMorphoBlueGroupedTable
          account={adapterAddress}
          positions={positions}
          refetch={refetch}
          isRefetching={isRefetching}
          isEarningsLoading={isEarningsLoading}
          actualBlockData={actualBlockData}
          transactions={transactions}
          snapshotsByChain={snapshotsByChain}
        />
      )}

      {!isPositionsLoading && hasBorrowPositions && (
        <BorrowedMorphoBlueTable
          account={adapterAddress}
          positions={positions}
          onRefetch={refetch}
          isRefetching={isRefetching}
        />
      )}

      {showEmpty && <div className="rounded bg-surface px-4 py-6 text-sm text-secondary shadow-sm">No positions.</div>}
    </div>
  );
}

export function VaultManagedExposures({
  fallbackAdapterAddress,
  fallbackAdapterType,
  chainId,
  period,
  vaultAddress,
}: VaultManagedExposuresProps) {
  const vaultDataQuery = useVaultV2Data({
    vaultAddress,
    chainId: chainId as SupportedNetworks,
  });

  const adapters = useMemo(() => {
    const adapterDetailsByAddress = new Map(
      (vaultDataQuery.data?.adapterDetails ?? []).map((adapter) => [adapter.address.toLowerCase(), adapter.adapterType]),
    );
    const rows: AdapterExposureDescriptor[] = [];
    const seen = new Set<string>();

    for (const adapterAddress of vaultDataQuery.data?.adapters ?? []) {
      const normalizedAddress = adapterAddress.toLowerCase() as Address;
      if (seen.has(normalizedAddress)) {
        continue;
      }

      seen.add(normalizedAddress);
      rows.push({
        address: normalizedAddress,
        adapterType:
          adapterDetailsByAddress.get(normalizedAddress) ??
          (fallbackAdapterAddress?.toLowerCase() === normalizedAddress ? fallbackAdapterType : undefined),
      });
    }

    if (fallbackAdapterAddress) {
      const normalizedAddress = fallbackAdapterAddress.toLowerCase() as Address;
      if (!seen.has(normalizedAddress)) {
        rows.push({
          address: normalizedAddress,
          adapterType: fallbackAdapterType,
        });
      }
    }

    return rows;
  }, [fallbackAdapterAddress, fallbackAdapterType, vaultDataQuery.data?.adapterDetails, vaultDataQuery.data?.adapters]);

  if (adapters.length === 0) {
    return null;
  }

  return (
    <section className="mt-2 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-secondary">Exposure</span>
        <span
          className="h-px min-w-8 flex-1 border-t border-dashed border-border/70"
          aria-hidden
        />
      </div>

      <div className="space-y-6">
        {adapters.map((adapter) => (
          <AdapterExposure
            key={`${chainId}:${adapter.address}`}
            adapterAddress={adapter.address}
            adapterType={adapter.adapterType}
            chainId={chainId}
            period={period}
          />
        ))}
      </div>
    </section>
  );
}
