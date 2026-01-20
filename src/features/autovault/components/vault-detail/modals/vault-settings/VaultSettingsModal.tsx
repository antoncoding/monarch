'use client';

import { useCallback } from 'react';
import type { Address } from 'viem';
import { Modal } from '@/components/common/Modal';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import type { SupportedNetworks } from '@/utils/networks';
import { VaultSettingsSidebar } from './VaultSettingsSidebar';
import { VaultSettingsContent } from './VaultSettingsContent';

type VaultSettingsModalProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

/**
 * VaultSettingsModal - Self-contained modal using Pull pattern with sidebar navigation.
 * Panels and details pull their own data using hooks internally.
 *
 * Open: useVaultSettingsModalStore().open('category')
 */
export function VaultSettingsModal({ vaultAddress, chainId }: VaultSettingsModalProps) {
  const { isOpen, activeCategory, activeDetailView, slideDirection, close, setCategory, navigateToDetail, navigateBack } =
    useVaultSettingsModalStore();

  const handleCategoryChange = useCallback(
    (category: typeof activeCategory) => {
      setCategory(category);
    },
    [setCategory],
  );

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
      scrollBehavior="normal"
      className="w-full max-w-6xl overflow-hidden"
      isDismissable={false}
    >
      <div className="flex h-[70vh] min-h-[500px] max-h-[800px]">
        <VaultSettingsSidebar
          selectedCategory={activeCategory}
          onSelectCategory={handleCategoryChange}
          disabled={activeDetailView !== null}
        />
        <VaultSettingsContent
          vaultAddress={vaultAddress}
          chainId={chainId}
          category={activeCategory}
          detailView={activeDetailView}
          slideDirection={slideDirection}
          onNavigateToDetail={navigateToDetail}
          onBack={navigateBack}
          onClose={close}
        />
      </div>
    </Modal>
  );
}
