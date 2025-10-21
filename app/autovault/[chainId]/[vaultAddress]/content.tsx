'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GearIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Address, zeroAddress } from 'viem';
import { useAccount, useCall } from 'wagmi';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import Header from '@/components/layout/header/Header';
// Removed useVaultDetails (was mock data)
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useAllocations } from '@/hooks/useAllocations';
import { getSlicedAddress } from '@/utils/address';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { TotalSupplyCard } from './components/TotalSupplyCard';
import { VaultAllocatorCard } from './components/VaultAllocatorCard';
import { VaultCollateralsCard } from './components/VaultCollateralsCard';
import { VaultInitializationModal } from './components/VaultInitializationModal';
// Removed VaultMarketAllocations - will be re-added when real data is available
import { VaultSettingsModal } from './components/VaultSettingsModal';
import { VaultSummaryMetrics } from './components/VaultSummaryMetrics';
import { VaultMarketAllocations } from './components/VaultMarketAllocations';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress  } = useParams<{ chainId: string; vaultAddress: string }>();
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
    } catch (error) {
      return null;
    }
  }, [chainId]);

  const [settingsTab, setSettingsTab] = useState<'general' | 'agents' | 'caps'>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showInitializationModal, setShowInitializationModal] = useState(false);

  const fallbackTitle = `Vault ${getSlicedAddress(vaultAddressValue)}`;
  
  const {
    data: vaultData,
    loading: vaultDataLoading,
    error: vaultDataError,
    refetch: refetchVaultDataFromAPI,
  } = useVaultV2Data({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const {
    isLoading: adapterLoading,
    refetch: refetchVaultFromContract,
    updateNameAndSymbol,
    isUpdatingMetadata,
    name: onChainName,
    symbol: onChainSymbol,
    setAllocator,
    isUpdatingAllocator,
    updateCaps,
    isUpdatingCaps,
    totalAssets
  } = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId,
    onTransactionSuccess: refetchVaultDataFromAPI,
  });

  // Use vaultData for owner check (from subgraph)
  const isOwner = Boolean(
    vaultData?.owner && connectedAddress && vaultData.owner.toLowerCase() === connectedAddress.toLowerCase(),
  );

  const {
    morphoMarketV1Adapter,
    loading: adaptersLoading,
    refetch: refetchMorphoAdapter,
  } = useMorphoMarketV1Adapters({ vaultAddress: vaultAddressValue, chainId });
  
  const needDeployMarketAdapater = useMemo(() => !adaptersLoading && morphoMarketV1Adapter === zeroAddress, [adapterLoading, morphoMarketV1Adapter]) ;

  const isError = !!vaultDataError;

  const title = vaultData?.displayName ?? fallbackTitle;
  const symbolToDisplay = vaultData?.displaySymbol;
  const allocators = vaultData?.allocators ?? [];
  const sentinels = vaultData?.sentinels ?? [];
  const allocatorCount = allocators.length;
  const hasNoAllocators = !needDeployMarketAdapater && allocatorCount === 0;
  const capsUninitialized = vaultData?.capsData?.needSetupCaps ?? true;
  const capData = vaultData?.capsData;
  const collateralCaps = capData?.collateralCaps ?? [];
  const marketCaps = capData?.marketCaps ?? [];


  // Memoize the caps array to prevent unnecessary refetches
  const allCaps = useMemo(() => {
    return [...collateralCaps, ...marketCaps];
  }, [collateralCaps, marketCaps]);

  // Fetch current allocations for all caps
  const { allocations: allAllocations, loading: allocationsLoading } = useAllocations({
    vaultAddress: vaultAddressValue,
    chainId,
    caps: allCaps,
    enabled: !needDeployMarketAdapater && !!capData,
  });

  const assetAddress = vaultData?.assetAddress;

  const refetchAll = useCallback(() => {
    refetchVaultDataFromAPI()
    refetchVaultFromContract()
  }, [])

  // TODO: Get real APY from subgraph or calculate from market allocations
  const apyLabel = '0%';

  if (isError) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[5%] py-12">
          <div className="mx-auto max-w-md rounded bg-surface p-8 text-center shadow-sm">
            <h2 className="mb-4 text-xl">Vault data unavailable</h2>
            <p className="mb-6 text-secondary">
              We could not load this autovault right now. Please retry in a few minutes.
            </p>
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
          <div className="flex items-start justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <h1 className="font-zen text-2xl">{title}</h1>
              {symbolToDisplay && (
                <span className="rounded bg-hovered px-2 py-1 text-xs text-secondary">{symbolToDisplay}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <AddressDisplay
                address={vaultAddressValue}
                chainId={chainId}
                size="sm"
                showExplorerLink
              />
              {isOwner && (
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

          {needDeployMarketAdapater && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Complete vault initialization</p>
                <p className="text-sm text-secondary">
                  Deploy adapter, configure registry, and optionally choose an agent to automate
                  this vault.
                </p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="mt-3 sm:mt-0"
                onPress={() => setShowInitializationModal(true)}
                isDisabled={adapterLoading}
              >
                Start setup
              </Button>
            </div>
          )}

          {hasNoAllocators && isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Choose an agent</p>
                <p className="text-sm text-secondary">
                  Add an agent to enable automated allocation and rebalancing.
                </p>
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

          {capsUninitialized && isOwner && (
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

          <VaultSummaryMetrics columns={4}>
            <TotalSupplyCard
              tokenDecimals={vaultData?.tokenDecimals}
              tokenSymbol={vaultData?.tokenSymbol}
              totalAssets={totalAssets}
              assetAddress={assetAddress as Address | undefined}
              chainId={chainId}
              vaultAddress={vaultAddressValue}
              vaultName={title}
              onRefresh={() => void refetchAll()}
            />
            <div className="rounded bg-surface p-4 shadow-sm">
              <span className="text-xs uppercase tracking-wide text-secondary">Current APY</span>
              <div className="mt-3 text-2xl text-primary">{apyLabel}</div>
            </div>
            <VaultAllocatorCard
              allocators={allocators}
              chainId={chainId}
              onManageAgents={() => {
                if (needDeployMarketAdapater && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                  setShowInitializationModal(true);
                  return;
                }
                setSettingsTab('agents');
                setShowSettings(true);
              }}
              needsSetup={needDeployMarketAdapater}
              isOwner={isOwner}
              isLoading={vaultDataLoading}
            />
            <VaultCollateralsCard
              collateralCaps={collateralCaps}
              chainId={chainId}
              onManageCaps={() => {
                setSettingsTab('caps');
                setShowSettings(true);
              }}
              needsSetup={needDeployMarketAdapater}
              isOwner={isOwner}
              isLoading={vaultDataLoading}
            />
          </VaultSummaryMetrics>

          {/* Market Allocations - Show current allocation state */}
          <VaultMarketAllocations
            marketCaps={marketCaps}
            collateralCaps={collateralCaps}
            allocations={allAllocations}
            totalAssets={totalAssets}
            vaultAssetSymbol={vaultData?.tokenSymbol ?? '--'}
            vaultAssetDecimals={vaultData?.tokenDecimals ?? 18}
            chainId={chainId}
            isLoading={allocationsLoading || vaultDataLoading}
          />
          <VaultSettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            initialTab={settingsTab}
            isOwner={isOwner}
            onUpdateMetadata={updateNameAndSymbol}
            updatingMetadata={isUpdatingMetadata}
            defaultName={vaultData?.displayName ?? ''}
            defaultSymbol={vaultData?.displaySymbol ?? ''}
            currentName={onChainName ?? ''}
            currentSymbol={onChainSymbol ?? ''}
            owner={vaultData?.owner}
            curator={vaultData?.curator}
            allocators={allocators}
            sentinels={sentinels}
            chainId={chainId}
            vaultAsset={assetAddress as Address | undefined}
            marketAdapter={morphoMarketV1Adapter}
            capData={capData}
            onSetAllocator={setAllocator}
            updateCaps={updateCaps}
            isUpdatingAllocator={isUpdatingAllocator}
            isUpdatingCaps={isUpdatingCaps}
            onRefresh={() => void refetchAll()}
            isRefreshing={vaultDataLoading}
          />
        </div>
      </div>

      {networkConfig?.vaultConfig?.marketV1AdapterFactory && (
        <VaultInitializationModal
          isOpen={showInitializationModal}
          marketAdapter={morphoMarketV1Adapter}
          refetchMarketAdapter={refetchMorphoAdapter}
          marketAdapterLoading={adaptersLoading}
          onClose={() => setShowInitializationModal(false)}
          vaultAddress={vaultAddressValue}
          chainId={chainId}
          onAdapterConfigured={() => {
            void refetchMorphoAdapter();
          }}
        />
      )}
    </div>
  );
}
