'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { GearIcon } from '@radix-ui/react-icons';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import Header from '@/components/layout/header/Header';
import { useVaultPage } from '@/hooks/useVaultPage';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { getSlicedAddress } from '@/utils/address';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { TotalSupplyCard } from '@/features/autovault/components/vault-detail/total-supply-card';
import { VaultAllocatorCard } from '@/features/autovault/components/vault-detail/vault-allocator-card';
import { VaultCollateralsCard } from '@/features/autovault/components/vault-detail/vault-collaterals-card';
import { VaultInitializationModal } from '@/features/autovault/components/vault-detail/modals/vault-initialization-modal';
import { VaultMarketAllocations } from '@/features/autovault/components/vault-detail/vault-market-allocations';
import { VaultSettingsModal } from '@/features/autovault/components/vault-detail/modals/vault-settings';
import { VaultSummaryMetrics } from '@/features/autovault/components/vault-detail/vault-summary-metrics';
import { TransactionHistoryPreview } from '@/features/history/components/transaction-history-preview';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useConnection();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const connectedAddress = hasMounted ? address : undefined;

  const chainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  const networkConfig = useMemo(() => {
    try {
      return getNetworkConfig(chainId);
    } catch (_error) {
      return null;
    }
  }, [chainId]);

  // Pull minimal data for vault-view itself
  const vaultDataQuery = useVaultV2Data({ vaultAddress: vaultAddressValue, chainId });
  const vaultContract = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId,
    connectedAddress,
    onTransactionSuccess: vaultDataQuery.refetch,
  });
  const adapterQuery = useMorphoMarketV1Adapters({ vaultAddress: vaultAddressValue, chainId });

  // Only use useVaultPage for complex computed state
  const { vaultAPY, isAPYLoading, isVaultInitialized, needsInitialization } = useVaultPage({
    vaultAddress: vaultAddressValue,
    chainId,
    connectedAddress,
  });

  const refetchVaultData = vaultDataQuery.refetch;
  const refetchVaultContract = vaultContract.refetch;
  const refetchAdapters = adapterQuery.refetch;

  const handleRefreshVault = useCallback(() => {
    void refetchVaultData();
    void refetchVaultContract();
    void refetchAdapters();
  }, [refetchVaultData, refetchVaultContract, refetchAdapters]);

  const isRefetching = vaultDataQuery.isRefetching || vaultContract.isRefetching || adapterQuery.isRefetching;

  // Extract minimal data for vault-view rendering
  const vaultData = vaultDataQuery.data;
  const hasError = vaultDataQuery.isError;
  const vaultDataLoading = vaultDataQuery.isLoading;
  const title = vaultData?.displayName ?? `Vault ${getSlicedAddress(vaultAddressValue)}`;
  const symbolToDisplay = vaultData?.displaySymbol;

  // UI state from Zustand stores (for vault-view banners only)
  const { open: openSettings } = useVaultSettingsModalStore();
  const { open: openInitialization } = useVaultInitializationModalStore();

  // Computed state flags for vault-view banners
  const hasNoAllocators = (vaultData?.allocators ?? []).length === 0;
  const capsUninitialized =
    !vaultData?.capsData || (vaultData.capsData.collateralCaps.length === 0 && vaultData.capsData.marketCaps.length === 0);

  // Format APY for APY card in vault-view
  const apyLabel = useMemo(() => {
    if (vaultAPY === null || vaultAPY === undefined) return '0%';
    return `${(vaultAPY * 100).toFixed(2)}%`;
  }, [vaultAPY]);

  // Show error state if data failed to load
  if (hasError) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[4%] py-12">
          <div className="mx-auto max-w-md rounded bg-surface p-8 text-center shadow-sm">
            <h2 className="mb-4 text-xl">Vault data unavailable</h2>
            <p className="mb-6 text-secondary">We could not load this autovault right now. Please retry in a few minutes.</p>
            <Link href="/autovault">
              <Button variant="primary">Back to Autovaults</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col font-zen">
      <Header />
      <div className="mx-auto container flex-1 pb-12 rounded">
        <div className="space-y-8">
          {/* Vault Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-zen text-2xl">{title}</h1>
              {symbolToDisplay && <span className="rounded bg-hovered px-2 py-1 text-xs text-secondary">{symbolToDisplay}</span>}
            </div>
            <div className="flex items-center gap-2">
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
                    onClick={handleRefreshVault}
                    disabled={vaultDataLoading}
                    className="text-secondary min-w-0 px-2"
                  >
                    <RefetchIcon isLoading={vaultDataLoading || isRefetching} />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip
                content={
                  <TooltipContent
                    title="Settings"
                    detail="Configure vault settings"
                  />
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-secondary min-w-0 px-2"
                  onClick={() => openSettings('general')}
                >
                  <GearIcon className="h-3 w-3" />
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Setup Banner - Show if vault needs initialization */}
          {needsInitialization && vaultContract.isOwner && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Complete vault setup</p>
                <p className="text-sm text-secondary">
                  Initialize your vault by deploying an adapter, and setting caps to start auto earning.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={openInitialization}
              >
                Start Setup
              </Button>
            </div>
          )}

          {/* Only show allocator/caps banners if vault IS initialized */}
          {isVaultInitialized && hasNoAllocators && vaultContract.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Choose an allocator</p>
                <p className="text-sm text-secondary">Add an allocator to enable automated allocation and rebalancing.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => openSettings('roles')}
              >
                Configure allocator
              </Button>
            </div>
          )}

          {isVaultInitialized && capsUninitialized && vaultContract.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Configure allocation caps</p>
                <p className="text-sm text-secondary">
                  Set allocation limits for markets to complete your vault strategy and activate automation.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => openSettings('caps')}
              >
                Configure caps
              </Button>
            </div>
          )}

          {/* Summary Metrics */}
          <VaultSummaryMetrics columns={4}>
            <TotalSupplyCard
              vaultAddress={vaultAddressValue}
              chainId={chainId}
            />
            <Card className="bg-surface rounded shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <span className="text-xs uppercase tracking-wide text-secondary">Current APY</span>
              </CardHeader>
              <CardBody className="flex items-center justify-center py-3">
                {vaultContract.isLoading || isAPYLoading ? (
                  <div className="bg-hovered h-6 w-20 rounded animate-pulse" />
                ) : (
                  <div className="text-lg text-primary">{apyLabel}</div>
                )}
              </CardBody>
            </Card>
            <VaultAllocatorCard
              vaultAddress={vaultAddressValue}
              chainId={chainId}
              needsInitialization={needsInitialization}
            />
            <VaultCollateralsCard
              vaultAddress={vaultAddressValue}
              chainId={chainId}
              needsInitialization={needsInitialization}
            />
          </VaultSummaryMetrics>

          {/* Market Allocations */}
          <VaultMarketAllocations
            vaultAddress={vaultAddressValue}
            chainId={chainId}
            needsInitialization={needsInitialization}
          />

          {/* Transaction History Preview - only show when vault is fully set up */}
          {adapterQuery.morphoMarketV1Adapter && isVaultInitialized && !capsUninitialized && (
            <TransactionHistoryPreview
              account={adapterQuery.morphoMarketV1Adapter}
              chainId={chainId}
              isVaultAdapter={true}
              emptyMessage="Setup complete, your automated rebalance will show up here once it's triggered."
            />
          )}

          {/* Settings Modal - Pulls own data */}
          <VaultSettingsModal
            vaultAddress={vaultAddressValue}
            chainId={chainId}
          />
        </div>
      </div>

      {/* Initialization Modal - Pulls own data from URL params */}
      {networkConfig?.vaultConfig?.marketV1AdapterFactory && <VaultInitializationModal />}
    </div>
  );
}
