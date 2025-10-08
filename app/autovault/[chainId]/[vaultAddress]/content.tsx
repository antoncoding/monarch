'use client';

import { useEffect, useMemo, useState } from 'react';
import { GearIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { TokenIcon } from '@/components/TokenIcon';
import { VaultAllocation, useVaultDetails } from '@/hooks/useAutovaultData';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { getSlicedAddress } from '@/utils/address';
import { formatBalance } from '@/utils/balance';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { VaultAgentSummary } from './components/VaultAgentSummary';
import { VaultApyHistory } from './components/VaultApyHistory';
import { VaultInitializationModal } from './components/VaultInitializationModal';
import { VaultMarketAllocations } from './components/VaultMarketAllocations';
import { VaultSettingsModal } from './components/VaultSettingsModal';
import { VaultSummaryMetrics } from './components/VaultSummaryMetrics';

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{ chainId: string; vaultAddress: string }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useAccount();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const connectedAddress = hasMounted ? address : undefined;
  const supportedChainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  const networkConfig = useMemo(() => {
    try {
      return getNetworkConfig(supportedChainId);
    } catch (error) {
      return null;
    }
  }, [supportedChainId]);

  const {
    needsSetup,
    isLoading: adapterLoading,
    refetch: refetchAdapter,
    updateNameAndSymbol,
    isUpdatingMetadata,
    name: onChainName,
    symbol: onChainSymbol,
  } = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId: supportedChainId,
  });

  const [settingsTab, setSettingsTab] = useState<'general' | 'agents' | 'allocations'>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showInitializationModal, setShowInitializationModal] = useState(false);

  const { vault: vaultDetails, isLoading, isError } = useVaultDetails(vaultAddressValue);

  const isOwner = Boolean(
    vaultDetails.owner && connectedAddress && vaultDetails.owner.toLowerCase() === connectedAddress.toLowerCase(),
  );

  const marketAllocations: VaultAllocation[] = vaultDetails.allocations ?? [];
  const vaultAssetSymbol = marketAllocations[0]?.assetSymbol ?? '—';
  const fallbackTitle = `Vault ${getSlicedAddress(vaultAddressValue)}`;
  const { data: vaultData, loading: vaultDataLoading } = useVaultV2Data({
    vaultAddress: vaultAddressValue,
    chainId: supportedChainId,
    fallbackName: vaultDetails.name?.trim(),
    fallbackSymbol: vaultDetails.symbol?.trim(),
    onChainName,
    onChainSymbol,
    ownerAddress: vaultDetails.owner,
    defaultAllocatorAddresses: vaultDetails.agents.map((agent) => agent.id),
  });
  const isFetchingSummary = isLoading || vaultDataLoading;

  const title = vaultData.displayName || fallbackTitle;
  const symbolToDisplay = vaultData.displaySymbol;
  const allocatorAddresses = vaultData.allocatorAddresses;
  const guardianAddresses = vaultData.guardianAddresses;
  const allocatorCount = vaultData.allocatorCount;
  const roleStatusText = useMemo(() => {
    if (needsSetup) return 'Adapter pending deployment';
    if (!vaultData.curatorAddress) return 'Curator not assigned yet';
    if (allocatorCount === 0) return 'Add an allocator to enable automation';
    return 'All critical roles are assigned to safe wallets.';
  }, [allocatorCount, needsSetup, vaultData.curatorAddress]);

  const assetAddress = vaultData.assetAddress;

  const totalSupplyLabel = useMemo(() => {
    if (!vaultData.totalSupplyRaw || vaultData.tokenDecimals === undefined) return '--';

    try {
      const rawSupply = BigInt(vaultData.totalSupplyRaw);
      const numericSupply = formatBalance(rawSupply, vaultData.tokenDecimals);
      const formattedSupply = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericSupply);

      return `${formattedSupply}${vaultData.tokenSymbol ? ` ${vaultData.tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return '--';
    }
  }, [vaultData.tokenDecimals, vaultData.tokenSymbol, vaultData.totalSupplyRaw]);

  const apyLabel = vaultDetails.currentApy ? `${vaultDetails.currentApy.toFixed(2)}%` : '0%';

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
          {isFetchingSummary ? (
            <div className="rounded bg-surface p-6 pt-8 shadow-sm">
              <LoadingScreen message="Loading vault insights..." className="mx-auto max-w-md" />
            </div>
          ) : (
            <>
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
                    chainId={supportedChainId}
                    size="sm"
                    showExplorerLink
                  />
                  {isOwner && (
                    <Button
                      variant="light"
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

              {needsSetup && networkConfig?.vaultConfig?.marketV1AdapterFactory && (
                <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-primary">Adapter not configured</p>
                    <p className="text-sm text-secondary">
                      Finish the initialization process to begin configuring strategies for this vault.
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

              <VaultSummaryMetrics>
                <div className="rounded bg-surface p-4 shadow-sm">
                  <span className="text-xs uppercase tracking-wide text-secondary">Total supply</span>
                  <div className="mt-3 flex items-center gap-2 text-2xl text-primary">
                    <span>{totalSupplyLabel}</span>
                    {assetAddress && (
                      <TokenIcon address={assetAddress} chainId={supportedChainId} width={20} height={20} />
                    )}
                  </div>
                  <div className="mt-1 text-sm text-secondary">
                    {vaultData.tokenSymbol ? `${vaultData.tokenSymbol} vault supply` : 'Vault token supply'}
                  </div>
                </div>
                <div className="rounded bg-surface p-4 shadow-sm">
                  <span className="text-xs uppercase tracking-wide text-secondary">Current APY</span>
                  <div className="mt-3 text-2xl text-primary">{apyLabel}</div>
                  <div className="mt-1 text-sm text-secondary">Live APY coming soon</div>
                </div>
                <div className="rounded bg-surface p-4 shadow-sm">
                  <span className="text-xs uppercase tracking-wide text-secondary">Allocators</span>
                  <div className="mt-3 text-2xl text-primary">{allocatorCount}</div>
                  <div className="mt-1 text-sm text-secondary">
                    {allocatorCount > 0 ? 'Active automation agents' : 'Add an allocator to enable automation'}
                  </div>
                </div>
              </VaultSummaryMetrics>

              <VaultAgentSummary
                isActive={vaultDetails.status === 'active'}
                activeAgents={allocatorCount}
                description={
                  needsSetup
                    ? 'Deploy the vault adapter before allocating capital.'
                    : vaultDetails.status === 'active'
                      ? 'Allocators are authorized and rebalancing within curator caps.'
                      : 'Authorize an allocator to resume automated portfolio management.'
                }
                roleStatusText={roleStatusText}
                onManageAgents={() => {
                  if (needsSetup && networkConfig?.vaultConfig?.marketV1AdapterFactory) {
                    setShowInitializationModal(true);
                    return;
                  }
                  setSettingsTab('agents');
                  setShowSettings(true);
                }}
                onManageAllocations={() => {
                  setSettingsTab('allocations');
                  setShowSettings(true);
                }}
              />

              <VaultMarketAllocations
                allocations={marketAllocations}
                vaultAssetSymbol={vaultAssetSymbol}
              />
              <VaultApyHistory timeframes={['7D', '30D', '90D']} />
              <VaultSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                initialTab={settingsTab}
                isOwner={isOwner}
                onUpdateMetadata={updateNameAndSymbol}
                updatingMetadata={isUpdatingMetadata}
                defaultName={vaultData.displayName}
                defaultSymbol={vaultData.displaySymbol}
                currentName={onChainName ?? ''}
                currentSymbol={onChainSymbol ?? ''}
                ownerAddress={vaultData.ownerAddress}
                curatorAddress={vaultData.curatorAddress}
                allocatorAddresses={allocatorAddresses}
                guardianAddresses={guardianAddresses}
              />
            </>
          )}
        </div>
      </div>

      {networkConfig?.vaultConfig?.marketV1AdapterFactory && (
        <VaultInitializationModal
          isOpen={showInitializationModal}
          onClose={() => setShowInitializationModal(false)}
          vaultAddress={vaultAddressValue}
          chainId={supportedChainId}
          onAdapterConfigured={() => void refetchAdapter()}
        />
      )}
    </div>
  );
}
