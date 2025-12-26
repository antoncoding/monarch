'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { GearIcon, ReloadIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import Header from '@/components/layout/header/Header';
import { useVaultPage } from '@/hooks/useVaultPage';
import { useVaultIndexing } from '@/hooks/useVaultIndexing';
import { getSlicedAddress } from '@/utils/address';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { TotalSupplyCard } from '@/features/autovault/components/vault-detail/total-supply-card';
import { VaultAllocatorCard } from '@/features/autovault/components/vault-detail/vault-allocator-card';
import { VaultCollateralsCard } from '@/features/autovault/components/vault-detail/vault-collaterals-card';
import { VaultInitializationModal } from '@/features/autovault/components/vault-detail/modals/vault-initialization-modal';
import { VaultMarketAllocations } from '@/features/autovault/components/vault-detail/vault-market-allocations';
import { VaultSettingsModal } from '@/features/autovault/components/vault-detail/modals/vault-settings-modal';
import { VaultSummaryMetrics } from '@/features/autovault/components/vault-detail/vault-summary-metrics';
import { TransactionHistoryPreview } from '@/features/history/components/transaction-history-preview';
import { VaultIdProvider } from '@/contexts/VaultIdContext';
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

  // Unified data hook - all vault data and actions in one place
  const vault = useVaultPage({
    vaultAddress: vaultAddressValue,
    chainId,
    connectedAddress,
  });

  const {
    refetchAll,
    completeInitialization,
    isInitializing,
    updateNameAndSymbol,
    setAllocator,
    refetchAdapter,
    collateralAllocations,
    marketAllocations,
    vaultAPY,
    vault24hEarnings,
    isAPYLoading,
  } = vault;

  const handleRefreshVault = useCallback(() => {
    void refetchAll();
  }, [refetchAll]);

  // Determine if vault data has loaded successfully
  const isDataLoaded = useMemo(() => {
    return !vault.vaultDataLoading && !vault.hasError && vault.vaultData !== null;
  }, [vault.vaultDataLoading, vault.hasError, vault.vaultData]);

  // Use indexing hook to manage retry logic and toast
  const { isIndexing } = useVaultIndexing({
    vaultAddress: vaultAddressValue,
    chainId,
    isDataLoaded,
    refetch: handleRefreshVault,
  });

  const handleUpdateMetadata = useCallback(
    async (values: { name?: string; symbol?: string }) => updateNameAndSymbol(values),
    [updateNameAndSymbol],
  );

  const handleSetAllocator = useCallback(
    async (allocator: Address, isAllocator: boolean) => setAllocator(allocator, isAllocator),
    [setAllocator],
  );

  // UI state from Zustand stores
  const { open: openSettings } = useVaultSettingsModalStore();
  const { open: openInitialization } = useVaultInitializationModalStore();

  // Derived display data
  const fallbackTitle = `Vault ${getSlicedAddress(vaultAddressValue)}`;
  const title = vault.vaultData?.displayName ?? fallbackTitle;
  const symbolToDisplay = vault.vaultData?.displaySymbol;
  const allocators = vault.vaultData?.allocators ?? [];
  const sentinels = vault.vaultData?.sentinels ?? [];
  const capData = vault.vaultData?.capsData;
  const collateralCaps = capData?.collateralCaps ?? [];
  const assetAddress = vault.vaultData?.assetAddress;

  // Format APY
  const apyLabel = useMemo(() => {
    if (vaultAPY === null || vaultAPY === undefined) return '0%';
    return `${(vaultAPY * 100).toFixed(2)}%`;
  }, [vaultAPY]);

  // Show loading state if indexing (prevents UI jumping)
  if (isIndexing) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12 rounded">
          <div className="space-y-8">
            {/* Loading skeleton */}
            <div className="animate-pulse space-y-8">
              <div className="flex items-center justify-between">
                <div className="bg-hovered h-8 w-64 rounded" />
                <div className="bg-hovered h-8 w-24 rounded" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-surface rounded shadow-sm p-4 space-y-3"
                  >
                    <div className="bg-hovered h-4 w-20 rounded" />
                    <div className="bg-hovered h-6 w-32 rounded" />
                  </div>
                ))}
              </div>
              <div className="bg-surface rounded shadow-sm p-6 space-y-4">
                <div className="bg-hovered h-6 w-48 rounded" />
                <div className="bg-hovered h-32 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load (but not while indexing)
  if (vault.hasError) {
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
    <VaultIdProvider value={{ vaultAddress: vaultAddressValue, chainId }}>
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12 rounded">
          <div className="space-y-8">
            {/* Vault Header */}
            <div className="flex items-start justify-between gap-4">
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
                      disabled={vault.vaultDataLoading}
                      className="text-secondary min-w-0 px-2"
                    >
                      <ReloadIcon className={`${vault.vaultDataLoading ? 'animate-spin' : ''} h-3 w-3`} />
                    </Button>
                  </span>
                </Tooltip>
                {vault.isOwner && (
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
                )}
              </div>
            </div>

          {/* Setup Banner - Show if vault needs initialization */}
          {vault.needsInitialization && vault.isOwner && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Complete vault setup</p>
                <p className="text-sm text-secondary">
                  Initialize your vault by deploying an adapter, setting caps, and configuring the registry to start using your vault.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => setShowInitializationModal(true)}
              >
                Start Setup
              </Button>
            </div>
          )}

          {/* Only show allocator/caps banners if vault IS initialized */}
          {vault.isVaultInitialized && vault.hasNoAllocators && vault.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Choose an agent</p>
                <p className="text-sm text-secondary">Add an agent to enable automated allocation and rebalancing.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => {
                  setSettingsTab('agents');
                  setShowSettings(true);
                }}
              >
                Configure agents
              </Button>
            </div>
          )}

          {vault.isVaultInitialized && vault.capsUninitialized && vault.isOwner && (
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
                onClick={() => {
                  setSettingsTab('caps');
                  setShowSettings(true);
                }}
              >
                Configure caps
              </Button>
            </div>
          )}

          {/* Summary Metrics */}
          <VaultSummaryMetrics columns={4}>
            <TotalSupplyCard
              tokenDecimals={vault.vaultData?.tokenDecimals}
              tokenSymbol={vault.vaultData?.tokenSymbol}
              totalAssets={vault.totalAssets}
              vault24hEarnings={vault24hEarnings}
              assetAddress={assetAddress as Address | undefined}
              chainId={chainId}
              vaultAddress={vaultAddressValue}
              vaultName={title}
              onRefresh={handleRefreshVault}
              isLoading={vault.isLoading}
            />
            <Card className="bg-surface rounded shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <span className="text-xs uppercase tracking-wide text-secondary">Current APY</span>
              </CardHeader>
              <CardBody className="flex items-center justify-center py-3">
                {vault.isLoading || isAPYLoading ? (
                  <div className="bg-hovered h-6 w-20 rounded animate-pulse" />
                ) : (
                  <div className="text-lg text-primary">{apyLabel}</div>
                )}
              </CardBody>
            </Card>
            <VaultAllocatorCard
              allocators={allocators}
              onManageAgents={() => {
                if (vault.needsInitialization && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                  setShowInitializationModal(true);
                  return;
                }
                setSettingsTab('agents');
                setShowSettings(true);
              }}
              needsSetup={vault.needsInitialization}
              isOwner={vault.isOwner}
              isLoading={vault.vaultDataLoading}
            />
            <VaultCollateralsCard
              collateralCaps={collateralCaps}
              chainId={chainId}
              onManageCaps={() => {
                if (vault.needsInitialization && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                  setShowInitializationModal(true);
                  return;
                }
                setSettingsTab('caps');
                setShowSettings(true);
              }}
              needsSetup={vault.needsInitialization}
              isOwner={vault.isOwner}
              isLoading={vault.vaultDataLoading}
            />
          </VaultSummaryMetrics>

          {/* Market Allocations */}
          <VaultMarketAllocations
            collateralAllocations={collateralAllocations}
            marketAllocations={marketAllocations}
            totalAssets={vault.totalAssets}
            vaultAssetSymbol={vault.vaultData?.tokenSymbol ?? '--'}
            vaultAssetDecimals={vault.vaultData?.tokenDecimals ?? 18}
            chainId={chainId}
            isLoading={vault.allocationsLoading || vault.vaultDataLoading}
            needsInitialization={vault.needsInitialization}
          />

          {/* Transaction History Preview - only show when vault is fully set up */}
          {vault.adapter && vault.isVaultInitialized && !vault.capsUninitialized && (
            <TransactionHistoryPreview
              account={vault.adapter}
              chainId={chainId}
              isVaultAdapter={true}
              limit={10}
              emptyMessage="Setup complete, your automated rebalance will show up here once it's triggered."
            />
          )}

          {/* Settings Modal */}
          <VaultSettingsModal
            isOpen={showSettings}
            onOpenChange={setShowSettings}
            initialTab={settingsTab}
            isOwner={vault.isOwner}
            onUpdateMetadata={handleUpdateMetadata}
            updatingMetadata={vault.isUpdatingMetadata}
            defaultName={vault.vaultData?.displayName ?? ''}
            defaultSymbol={vault.vaultData?.displaySymbol ?? ''}
            currentName={vault.onChainName ?? ''}
            currentSymbol={vault.onChainSymbol ?? ''}
            owner={vault.vaultData?.owner}
            curator={vault.vaultData?.curator}
            allocators={allocators}
            sentinels={sentinels}
            chainId={chainId}
            vaultAsset={assetAddress as Address | undefined}
            marketAdapter={vault.adapter}
            capData={capData}
            onSetAllocator={handleSetAllocator}
            updateCaps={vault.updateCaps}
            isUpdatingAllocator={vault.isUpdatingAllocator}
            isUpdatingCaps={vault.isUpdatingCaps}
            onRefresh={handleRefreshVault}
            isRefreshing={vault.vaultDataLoading}
          />
        </div>
      </div>

      {/* Initialization Modal */}
      {networkConfig?.vaultConfig?.marketV1AdapterFactory && (
        <VaultInitializationModal
          isOpen={showInitializationModal}
          onOpenChange={setShowInitializationModal}
          vaultAddress={vaultAddressValue}
          chainId={chainId}
          marketAdapter={vault.adapter}
          marketAdapterLoading={vault.adapterLoading}
          refetchMarketAdapter={handleRefetchAdapter}
          onAdapterConfigured={handleAdapterConfigured}
          completeInitialization={completeInitialization}
          isInitializing={isInitializing}
        />
      )}
    </div>
  );
}
