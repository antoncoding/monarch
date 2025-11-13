"use client";

import { useCallback, useEffect, useState } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { FiSettings } from 'react-icons/fi';
import { Address } from 'viem';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { CapData } from '@/hooks/useVaultV2Data';
import { SupportedNetworks } from '@/utils/networks';
import { GeneralTab, AgentsTab, CapsTab, SettingsTab } from './settings';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agent' },
  { id: 'caps', label: 'Caps' },
];

type VaultSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
  isOwner: boolean;
  onUpdateMetadata: (values: { name?: string; symbol?: string }) => Promise<boolean>;
  updatingMetadata: boolean;
  defaultName: string;
  defaultSymbol: string;
  currentName: string;
  currentSymbol: string;
  owner?: string;
  curator?: string;
  allocators: string[];
  sentinels?: string[];
  chainId: SupportedNetworks;
  vaultAsset?: Address;
  marketAdapter: Address; // the deploy morpho market v1 adapter 
  capData?: CapData;
  onSetAllocator: (allocator: Address, isAllocator: boolean) => Promise<boolean>;
  updateCaps: (caps: VaultV2Cap[]) => Promise<boolean>;
  isUpdatingAllocator: boolean;
  isUpdatingCaps: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function VaultSettingsModal({
  isOpen,
  onOpenChange,
  initialTab = 'general',
  isOwner,
  onUpdateMetadata,
  updatingMetadata,
  defaultName,
  defaultSymbol,
  currentName,
  currentSymbol,
  owner,
  curator,
  allocators,
  sentinels = [],
  chainId,
  vaultAsset,
  marketAdapter,
  capData = undefined,
  onSetAllocator,
  updateCaps,
  isUpdatingAllocator,
  isUpdatingCaps,
  onRefresh,
  isRefreshing = false,
}: VaultSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            isOwner={isOwner}
            defaultName={defaultName}
            defaultSymbol={defaultSymbol}
            currentName={currentName}
            currentSymbol={currentSymbol}
            onUpdateMetadata={onUpdateMetadata}
            updatingMetadata={updatingMetadata}
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
            onSetAllocator={onSetAllocator}
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
            adapterAddress={marketAdapter}
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
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      className="w-full max-w-6xl"
      isDismissable={false}
    >
      <ModalHeader
        title="Vault Settings"
        description="Manage metadata, automation agents, and vault caps"
        mainIcon={<FiSettings className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
        auxiliaryAction={
          onRefresh
            ? {
                icon: (
                  <ReloadIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                ),
                onClick: () => {
                  if (!isRefreshing) {
                    onRefresh();
                  }
                },
                ariaLabel: 'Refresh vault data',
              }
            : undefined
        }
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
                  {activeTab === tab.id && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" />
                  )}
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
