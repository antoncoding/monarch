'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IoRefreshOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import Header from '@/components/layout/header/Header';
import { useVaultPage } from '@/hooks/useVaultPage';
import { getSlicedAddress } from '@/utils/address';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { TotalSupplyCard } from './components/TotalSupplyCard';
import { VaultAllocatorCard } from './components/VaultAllocatorCard';
import { VaultCollateralsCard } from './components/VaultCollateralsCard';
import { VaultInitializationModal } from './components/VaultInitializationModal';
import { VaultMarketAllocations } from './components/VaultMarketAllocations';
import { VaultSettingsModal } from './components/VaultSettingsModal';
import { VaultSummaryMetrics } from './components/VaultSummaryMetrics';

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useAccount();
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

  const handleUpdateMetadata = useCallback(
    async (values: { name?: string; symbol?: string }) => updateNameAndSymbol(values),
    [updateNameAndSymbol],
  );

  const handleSetAllocator = useCallback(
    async (allocator: Address, isAllocator: boolean) => setAllocator(allocator, isAllocator),
    [setAllocator],
  );

  const handleRefetchAdapter = useCallback(() => {
    void refetchAdapter();
  }, [refetchAdapter]);

  const handleAdapterConfigured = useCallback(() => {
    void refetchAll();
  }, [refetchAll]);

  // UI state
  const [settingsTab, setSettingsTab] = useState<'general' | 'agents' | 'caps'>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showInitializationModal, setShowInitializationModal] = useState(false);

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
    if (isAPYLoading) return '...';
    if (vaultAPY === null || vaultAPY === undefined) return '0%';
    return `${(vaultAPY * 100).toFixed(2)}%`;
  }, [vaultAPY, isAPYLoading]);

  if (vault.hasError) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[4%] py-12">
          <div className="mx-auto max-w-md rounded bg-surface p-8 text-center shadow-sm">
            <h2 className="mb-4 text-xl">Vault data unavailable</h2>
            <p className="mb-6 text-secondary">We could not load this autovault right now. Please retry in a few minutes.</p>
            <Link href="/autovault">
              <Button variant="cta">Back to Autovaults</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col font-zen">
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12">
        <div className="space-y-8">
          {/* Vault Header */}
          <div className="flex items-start justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <h1 className="font-zen text-2xl">{title}</h1>
              {symbolToDisplay && <span className="rounded bg-hovered px-2 py-1 text-xs text-secondary">{symbolToDisplay}</span>}
            </div>
            <div className="flex items-center gap-3">
              <AccountIdentity
                address={vaultAddressValue}
                variant="compact"
                linkTo="explorer"
              />
              <Button
                variant="light"
                size="sm"
                onPress={handleRefreshVault}
                isDisabled={vault.vaultDataLoading}
                className="font-zen text-secondary opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
              >
                <IoRefreshOutline className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {vault.isOwner && (
                <Button
                  variant="subtle"
                  size="sm"
                  onPress={() => {
                    setSettingsTab('general');
                    setShowSettings(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <GearIcon className="h-4 w-4" />
                  Settings
                </Button>
              )}
            </div>
          </div>

          {/* Setup Banners - Only show when data is loaded */}
          {!vault.vaultDataLoading && vault.needsAdapterDeployment && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Complete vault initialization</p>
                <p className="text-sm text-secondary">
                  Deploy adapter, configure registry, and optionally choose an agent to automate this vault.
                </p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="mt-3 sm:mt-0"
                onPress={() => setShowInitializationModal(true)}
                isDisabled={vault.isLoading}
              >
                Start setup
              </Button>
            </div>
          )}

          {!vault.vaultDataLoading && vault.hasNoAllocators && vault.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Choose an agent</p>
                <p className="text-sm text-secondary">Add an agent to enable automated allocation and rebalancing.</p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="mt-3 sm:mt-0"
                onPress={() => {
                  setSettingsTab('agents');
                  setShowSettings(true);
                }}
              >
                Configure agents
              </Button>
            </div>
          )}

          {!vault.vaultDataLoading && vault.capsUninitialized && vault.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Configure allocation caps</p>
                <p className="text-sm text-secondary">
                  Set allocation limits for markets to complete your vault strategy and activate automation.
                </p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="mt-3 sm:mt-0"
                onPress={() => {
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
            />
            <Card className="bg-surface rounded shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <span className="text-xs uppercase tracking-wide text-secondary">Current APY</span>
              </CardHeader>
              <CardBody className="flex items-center justify-center py-3">
                <div className="text-lg text-primary">{apyLabel}</div>
              </CardBody>
            </Card>
            <VaultAllocatorCard
              allocators={allocators}
              onManageAgents={() => {
                if (vault.needsAdapterDeployment && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                  setShowInitializationModal(true);
                  return;
                }
                setSettingsTab('agents');
                setShowSettings(true);
              }}
              needsSetup={vault.needsAdapterDeployment}
              isOwner={vault.isOwner}
              isLoading={vault.vaultDataLoading}
            />
            <VaultCollateralsCard
              collateralCaps={collateralCaps}
              chainId={chainId}
              onManageCaps={() => {
                setSettingsTab('caps');
                setShowSettings(true);
              }}
              needsSetup={vault.needsAdapterDeployment}
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
          />

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
        />
      )}
    </div>
  );
}
