'use client';

import { useCallback, useMemo } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { FiSettings } from 'react-icons/fi';
import type { Address } from 'viem';
import { useParams } from 'next/navigation';
import { useConnection } from 'wagmi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { GeneralTab, AgentsTab, CapsTab, type SettingsTab } from '../settings';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useMorphoMarketV1Adapters } from '@/hooks/useMorphoMarketV1Adapters';
import { ALL_SUPPORTED_NETWORKS, SupportedNetworks } from '@/utils/networks';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agent' },
  { id: 'caps', label: 'Caps' },
];

/**
 * VaultSettingsModal - Completely self-contained modal component.
 * Reads all data directly from Zustand stores and hooks - no props needed!
 *
 * Open this modal using: useVaultSettingsModalStore().open('tabName')
 */
export function VaultSettingsModal() {
  // Modal state from Zustand (UI state)
  const { isOpen, activeTab, close, setTab } = useVaultSettingsModalStore();

  // Get vault address and chain ID from URL params
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();

  const vaultAddressValue = vaultAddress as Address;
  const { address: connectedAddress } = useConnection();

  const chainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  // Fetch vault data
  const {
    data: vaultData,
    loading: vaultDataLoading,
    refetch: refetchVaultData,
  } = useVaultV2Data({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  // Transaction success handler
  const handleTransactionSuccess = useCallback(() => {
    void refetchVaultData();
  }, [refetchVaultData]);

  // Fetch vault contract state and actions
  const {
    name: onChainName,
    symbol: onChainSymbol,
    owner: contractOwner,
    updateNameAndSymbol,
    isUpdatingMetadata,
    setAllocator,
    isUpdatingAllocator,
    updateCaps,
    isUpdatingCaps,
    refetch: refetchContract,
  } = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId,
    onTransactionSuccess: handleTransactionSuccess,
  });

  // Fetch adapter
  const { morphoMarketV1Adapter: adapter } = useMorphoMarketV1Adapters({
    vaultAddress: vaultAddressValue,
    chainId
  });

  // Determine ownership
  const isOwner = useMemo(
    () => Boolean(contractOwner && connectedAddress && contractOwner.toLowerCase() === connectedAddress.toLowerCase()),
    [contractOwner, connectedAddress],
  );

  // Unified refetch function
  const refetchAll = useCallback(() => {
    void refetchVaultData();
    void refetchContract();
  }, [refetchVaultData, refetchContract]);

  // Extract data from vaultData
  const defaultName = vaultData?.displayName ?? '';
  const defaultSymbol = vaultData?.displaySymbol ?? '';
  const currentName = onChainName ?? '';
  const currentSymbol = onChainSymbol ?? '';
  const owner = vaultData?.owner;
  const curator = vaultData?.curator;
  const allocators = vaultData?.allocators ?? [];
  const sentinels = vaultData?.sentinels ?? [];
  const vaultAsset = vaultData?.assetAddress as Address | undefined;
  const capData = vaultData?.capsData;

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      setTab(tab);
    },
    [setTab],
  );

  const renderActiveTab = () => {
    if (!chainId) return null;

    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            isOwner={isOwner}
            defaultName={defaultName}
            defaultSymbol={defaultSymbol}
            currentName={currentName}
            currentSymbol={currentSymbol}
            onUpdateMetadata={updateNameAndSymbol}
            updatingMetadata={isUpdatingMetadata}
            chainId={chainId}
          />
        );
      case 'agents':
        return (
          <AgentsTab
            isOwner={isOwner}
            owner={owner}
            curator={curator}
            allocators={allocators}
            sentinels={sentinels}
            onSetAllocator={setAllocator}
            isUpdatingAllocator={isUpdatingAllocator}
            chainId={chainId}
          />
        );
      case 'caps':
        return (
          <CapsTab
            isOwner={isOwner}
            chainId={chainId}
            vaultAsset={vaultAsset}
            adapterAddress={adapter ?? undefined}
            existingCaps={capData}
            updateCaps={updateCaps}
            isUpdatingCaps={isUpdatingCaps}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      size="5xl"
      scrollBehavior="inside"
      className="w-full max-w-6xl"
      isDismissable={false}
    >
      <ModalHeader
        title="Vault Settings"
        description="Manage metadata, automation agents, and vault caps"
        mainIcon={<FiSettings className="h-5 w-5" />}
        onClose={close}
        auxiliaryAction={{
          icon: <ReloadIcon className={`h-4 w-4 ${vaultDataLoading ? 'animate-spin' : ''}`} />,
          onClick: () => {
            if (!vaultDataLoading) {
              refetchAll();
            }
          },
          ariaLabel: 'Refresh vault data',
        }}
      />
      <ModalBody className="px-0 pb-6">
        <div className="flex flex-col gap-6">
          <div className="border-b border-divider/30 px-6">
            <div className="flex flex-wrap gap-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative py-3 text-sm font-medium transition-colors focus-visible:outline-none ${
                    activeTab === tab.id ? 'text-primary' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 pb-2">
            <div className="min-h-[360px] space-y-6">{renderActiveTab()}</div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
