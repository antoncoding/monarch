'use client';

import { useCallback } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { FiSettings } from 'react-icons/fi';
import type { Address } from 'viem';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { GeneralTab, AgentsTab, CapsTab, type SettingsTab } from '../settings';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agent' },
  { id: 'caps', label: 'Caps' },
];

type VaultSettingsModalProps = {
  vaultAddress: Address;
  chainId: number;
};

/**
 * VaultSettingsModal - Self-contained modal using Pull pattern.
 * Tabs pull their own data using hooks internally.
 *
 * Open: useVaultSettingsModalStore().open('tabName')
 */
export function VaultSettingsModal({ vaultAddress, chainId }: VaultSettingsModalProps) {
  // UI state from Zustand
  const { isOpen, activeTab, close, setTab } = useVaultSettingsModalStore();

  // Only pull data needed for the modal header refresh button
  const vaultDataQuery = useVaultV2Data({ vaultAddress, chainId });

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      setTab(tab);
    },
    [setTab],
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            vaultAddress={vaultAddress}
            chainId={chainId}
          />
        );
      case 'agents':
        return (
          <AgentsTab
            vaultAddress={vaultAddress}
            chainId={chainId}
          />
        );
      case 'caps':
        return (
          <CapsTab
            vaultAddress={vaultAddress}
            chainId={chainId}
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
          icon: <ReloadIcon className={`h-4 w-4 ${vaultDataQuery.isLoading ? 'animate-spin' : ''}`} />,
          onClick: () => {
            if (!vaultDataQuery.isLoading) {
              void vaultDataQuery.refetch();
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
