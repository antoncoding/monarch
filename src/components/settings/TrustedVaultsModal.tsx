'use client';

import React, { useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  Input,
} from '@heroui/react';
import { GoShield, GoShieldCheck } from 'react-icons/go';
import { Button } from '@/components/common';
import { IconSwitch } from '@/components/common/IconSwitch';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import { VaultIdentity } from '@/components/vaults/VaultIdentity';
import { trusted_vaults, type TrustedVault } from '@/constants/vaults/trusted_vaults';

type TrustedVaultsModalProps = {
  isOpen: boolean;
  onOpenChange: () => void;
  userTrustedVaults: TrustedVault[];
  setUserTrustedVaults: (vaults: TrustedVault[]) => void;
};

export default function TrustedVaultsModal({
  isOpen,
  onOpenChange,
  userTrustedVaults,
  setUserTrustedVaults,
}: TrustedVaultsModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  // For now, we only have trusted_vaults. Later we'll add morpho_whitelisted_vaults
  const allAvailableVaults = useMemo(() => {
    return trusted_vaults;
  }, []);

  // Filter and sort vaults based on search query
  const sortedVaults = useMemo(() => {
    let vaults = allAvailableVaults;

    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      vaults = vaults.filter((vault) => {
        return (
          vault.name.toLowerCase().includes(query) ||
          vault.vendor.toLowerCase().includes(query) ||
          vault.address.toLowerCase().includes(query)
        );
      });
    }

    // Sort by vendor name, then by vault name
    return [...vaults].sort((a, b) => {
      const vendorCompare = a.vendor.localeCompare(b.vendor);
      if (vendorCompare !== 0) return vendorCompare;
      return a.name.localeCompare(b.name);
    });
  }, [allAvailableVaults, searchQuery]);

  const isVaultTrusted = (vault: TrustedVault) => {
    return userTrustedVaults.some(
      (v) => v.address.toLowerCase() === vault.address.toLowerCase() && v.chainId === vault.chainId
    );
  };

  const toggleVault = (vault: TrustedVault) => {
    const isTrusted = isVaultTrusted(vault);

    if (isTrusted) {
      // Remove vault
      setUserTrustedVaults(
        userTrustedVaults.filter(
          (v) => !(v.address.toLowerCase() === vault.address.toLowerCase() && v.chainId === vault.chainId)
        )
      );
    } else {
      // Add vault
      setUserTrustedVaults([...userTrustedVaults, vault]);
    }
  };

  const handleSelectAll = () => {
    setUserTrustedVaults([...allAvailableVaults]);
  };

  const handleDeselectAll = () => {
    setUserTrustedVaults([]);
  };

  const handleResetToDefaults = () => {
    setUserTrustedVaults([...trusted_vaults]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="3xl"
      classNames={{
        wrapper: 'z-[2300]',
        backdrop: 'z-[2290]',
      }}
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 font-zen">
              Manage Trusted Vaults
            </ModalHeader>
            <ModalBody className="flex flex-col gap-5 px-4 pb-6 pt-2 md:px-6">
              {/* Info Section */}
              <div className="bg-surface-soft rounded p-4">
                <p className="text-sm text-secondary">
                  Select which vaults you trust. Trusted vaults can be used to filter markets based on
                  vault participation. By default, all curated vaults are trusted.
                </p>
              </div>

              {/* Search and Actions */}
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Search by name, vendor, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                  className="w-full"
                />

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="flat" onPress={handleSelectAll}>
                    Select All
                  </Button>
                  <Button size="sm" variant="flat" onPress={handleDeselectAll}>
                    Deselect All
                  </Button>
                  <Button size="sm" variant="flat" onPress={handleResetToDefaults}>
                    Reset to Defaults
                  </Button>
                  <div className="ml-auto text-xs text-secondary self-center">
                    {userTrustedVaults.length} / {allAvailableVaults.length} selected
                  </div>
                </div>
              </div>

              <Divider />

              {/* Monarch Whitelisted Vaults List */}
              <div className="flex flex-col gap-3">
                <h3 className="font-zen text-sm uppercase text-secondary">
                  Monarch Whitelisted ({sortedVaults.length})
                </h3>

                {sortedVaults.length === 0 ? (
                  <div className="text-center text-sm text-secondary py-8">
                    No vaults found matching your search.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sortedVaults.map((vault) => {
                      const trusted = isVaultTrusted(vault);

                      return (
                        <div
                          key={`${vault.address}-${vault.chainId}`}
                          className="flex items-center justify-between gap-4 rounded bg-surface p-3 transition-colors hover:bg-surface-dark"
                        >
                          <div className="flex flex-grow items-center gap-3">
                            <NetworkIcon networkId={vault.chainId} />
                            <VaultIdentity
                              address={vault.address as `0x${string}`}
                              chainId={vault.chainId}
                              vendor={vault.vendor}
                              vaultName={vault.name}
                              showLink={true}
                              showIcon={true}
                            />
                          </div>
                          <IconSwitch
                            selected={trusted}
                            onChange={() => toggleVault(vault)}
                            size="xs"
                            color="primary"
                            thumbIcon={trusted ? GoShieldCheck : GoShield}
                            aria-label={`Toggle trust for ${vault.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
