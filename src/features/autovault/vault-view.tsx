'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { useVaultPage } from '@/hooks/useVaultPage';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { getSlicedAddress } from '@/utils/address';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks, getNetworkConfig } from '@/utils/networks';
import { parseCapIdParams } from '@/utils/morpho';
import { VaultInitializationModal } from '@/features/autovault/components/vault-detail/modals/vault-initialization-modal';
import { VaultMarketAllocations } from '@/features/autovault/components/vault-detail/vault-market-allocations';
import { VaultSettingsModal } from '@/features/autovault/components/vault-detail/modals/vault-settings';
import { TransactionHistoryPreview } from '@/features/history/components/transaction-history-preview';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';
import { VaultHeader } from '@/features/autovault/components/vault-detail/vault-header';
import { useModal } from '@/hooks/useModal';
import { formatBalance } from '@/utils/balance';

import { useTokensQuery } from '@/hooks/queries/useTokensQuery';

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useConnection();
  const [hasMounted, setHasMounted] = useState(false);
  const { open: openModal } = useModal();
  const { findToken } = useTokensQuery();

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
  const { vaultAPY, isVaultInitialized, needsInitialization } = useVaultPage({
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
  const tokenDecimals = vaultData?.tokenDecimals;
  const tokenSymbol = vaultData?.tokenSymbol;
  const assetAddress = vaultData?.assetAddress as Address | undefined;

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

  const totalAssetsLabel = useMemo(() => {
    if (vaultContract.totalAssets === undefined || tokenDecimals === undefined) return '--';

    try {
      const numericAssets = formatBalance(vaultContract.totalAssets, tokenDecimals);
      const formattedAssets = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericAssets);

      return `${formattedAssets}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return '--';
    }
  }, [tokenDecimals, tokenSymbol, vaultContract.totalAssets]);

  const userShareBalanceLabel = useMemo(() => {
    if (vaultContract.userAssets === undefined || tokenDecimals === undefined || vaultContract.userAssets === 0n) return undefined;
    try {
      const numericAssets = formatBalance(vaultContract.userAssets, tokenDecimals);
      const formattedAssets = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericAssets);
      return `${formattedAssets}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return undefined;
    }
  }, [tokenDecimals, tokenSymbol, vaultContract.userAssets]);

  // Extract collateral addresses from caps for header
  const collateralAddresses = useMemo(() => {
    return (vaultData?.capsData.collateralCaps ?? [])
      .map((cap) => {
        const addr = parseCapIdParams(cap.idParams).collateralToken;
        if (!addr) return null;
        const token = findToken(addr, chainId);
        return {
          address: addr,
          symbol: token?.symbol ?? 'Unknown',
          amount: 1, // Use 1 as placeholder since we're just showing presence
        };
      })
      .filter((c): c is { address: string; symbol: string; amount: number } => !!c);
  }, [vaultData?.capsData.collateralCaps, findToken, chainId]);

  const handleDeposit = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultDeposit', {
      vaultAddress: vaultAddressValue,
      vaultName: title,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleRefreshVault,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddressValue, title, chainId, openModal, handleRefreshVault]);

  const handleWithdraw = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultWithdraw', {
      vaultAddress: vaultAddressValue,
      vaultName: title,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleRefreshVault,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddressValue, title, chainId, openModal, handleRefreshVault]);

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
          {/* Unified Vault Header */}
          <VaultHeader
            vaultAddress={vaultAddressValue}
            chainId={chainId}
            title={title}
            symbol={symbolToDisplay ?? ''}
            assetAddress={assetAddress}
            assetSymbol={tokenSymbol}
            totalAssetsLabel={totalAssetsLabel}
            apyLabel={apyLabel}
            userShareBalance={userShareBalanceLabel}
            allocators={vaultData?.allocators}
            collaterals={collateralAddresses}
            curator={vaultData?.curator}
            adapter={adapterQuery.morphoMarketV1Adapter ?? undefined}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            onRefresh={handleRefreshVault}
            onSettings={() => openSettings('general')}
            isRefetching={isRefetching}
            isLoading={vaultDataLoading || vaultContract.isLoading}
          />

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
