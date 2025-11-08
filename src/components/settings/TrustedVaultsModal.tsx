'use client';

import React, { useMemo, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  Input,
  Spinner,
} from '@heroui/react';
import { GoShield, GoShieldCheck } from 'react-icons/go';
import { IoWarningOutline } from 'react-icons/io5';
import { Button } from '@/components/common';
import { IconSwitch } from '@/components/common/IconSwitch';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import { VaultIdentity } from '@/components/vaults/VaultIdentity';
import {
  defaultTrustedVaults,
  known_vaults,
  type KnownVault,
  type TrustedVault,
} from '@/constants/vaults/known_vaults';
import { useAllMorphoVaults } from '@/hooks/useAllMorphoVaults';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

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
  const [morphoSectionOpen, setMorphoSectionOpen] = useState(false);

  // Fetch all Morpho vaults from API
  const { vaults: morphoVaults, loading: morphoLoading } = useAllMorphoVaults();

  // Transform Morpho API vaults to TrustedVault format
  const morphoWhitelistedVaults = useMemo<KnownVault[]>(() => {
    return morphoVaults.map((vault) => ({
      address: vault.address as `0x${string}`,
      chainId: vault.chainId,
      name: vault.name,
      curator: 'unknown',
      asset: vault.assetAddress as `0x${string}`,
    }));
  }, [morphoVaults]);

  // Combine both known vaults (Monarch) and Morpho API vaults
  const allAvailableVaults = useMemo<KnownVault[]>(() => {
    // Create a Set of Monarch vault keys to avoid duplicates
    const monarchVaultKeys = new Set(
      known_vaults.map((v) => `${v.address.toLowerCase()}-${v.chainId}`)
    );

    // Filter out Morpho vaults that are already in Monarch's list
    const uniqueMorphoVaults = morphoWhitelistedVaults.filter(
      (v) => !monarchVaultKeys.has(`${v.address.toLowerCase()}-${v.chainId}`)
    );

    return [...known_vaults, ...uniqueMorphoVaults];
  }, [morphoWhitelistedVaults]);

  // Filter and sort vaults based on search query
  const filterAndSortVaults = (vaults: KnownVault[]) => {
    let filtered = vaults;

    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((vault) => {
        return (
          vault.name.toLowerCase().includes(query) ||
          vault.curator.toLowerCase().includes(query) ||
          vault.address.toLowerCase().includes(query)
        );
      });
    }

    // Sort by vendor name, then by vault name
    return [...filtered].sort((a, b) => {
      const defaultScore = Number(Boolean(b.defaultTrusted)) - Number(Boolean(a.defaultTrusted));
      if (defaultScore !== 0) return defaultScore;

      const curatorCompare = a.curator.localeCompare(b.curator);
      if (curatorCompare !== 0) return curatorCompare;
      return a.name.localeCompare(b.name);
    });
  };

  // Separate lists for Monarch and Morpho vaults
  const sortedMonarchVaults = useMemo(() => {
    return filterAndSortVaults(known_vaults);
  }, [searchQuery]);

  const sortedMorphoVaults = useMemo(() => {
    // Filter out duplicates that are already in Monarch list
    const monarchVaultKeys = new Set(
      known_vaults.map((v) => `${v.address.toLowerCase()}-${v.chainId}`)
    );
    const uniqueMorphoVaults = morphoWhitelistedVaults.filter(
      (v) => !monarchVaultKeys.has(`${v.address.toLowerCase()}-${v.chainId}`)
    );
    return filterAndSortVaults(uniqueMorphoVaults);
  }, [morphoWhitelistedVaults, searchQuery]);

  const isVaultTrusted = (vault: TrustedVault | KnownVault) => {
    return userTrustedVaults.some(
      (v) => v.address.toLowerCase() === vault.address.toLowerCase() && v.chainId === vault.chainId
    );
  };

  const formatVaultForStorage = (vault: KnownVault): TrustedVault => ({
    address: vault.address,
    chainId: vault.chainId,
    curator: vault.curator,
    name: vault.name,
    asset: vault.asset,
  });

  const toggleVault = (vault: KnownVault) => {
    const isTrusted = isVaultTrusted(vault);

    if (isTrusted) {
      // Remove vault
      setUserTrustedVaults(
        userTrustedVaults.filter(
          (v) =>
            !(
              v.address.toLowerCase() === vault.address.toLowerCase() &&
              v.chainId === vault.chainId
            )
        )
      );
    } else {
      // Add vault
      setUserTrustedVaults([...userTrustedVaults, formatVaultForStorage(vault)]);
    }
  };

  const handleSelectAll = () => {
    setUserTrustedVaults(allAvailableVaults.map((vault) => formatVaultForStorage(vault)));
  };

  const handleDeselectAll = () => {
    setUserTrustedVaults([]);
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
            <ModalHeader className="flex flex-col gap-1 font-zen px-10 pt-6">
              Manage Trusted Vaults
            </ModalHeader>
            <ModalBody className="flex flex-col gap-5 px-4 pb-6 pt-2 md:px-6">
              {/* Info Section */}
              <div className="bg-surface-soft rounded p-4">
                <p className="font-zen text-sm text-secondary">
                  Select which vaults you trust. Trusted vaults can be used to filter markets based on
                  vault participation.
                </p>
                <div className="mt-3 flex items-start gap-3 rounded bg-yellow-500/10 p-3 text-yellow-700">
                  <IoWarningOutline className="mt-0.5 h-4 w-4" />
                  <p className="font-zen text-sm">
                    Vaults are managed by third-party curators. Markets trusted by those vaults are not
                    guaranteed to be risk-free. Always do your own research before trusting any
                    vault.
                  </p>
                </div>
              </div>

              {/* Search and Actions */}
              <div className="flex flex-col gap-3 px-4">
                <Input
                  placeholder="Search by name, curator, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                  className="w-full font-zen"
                />

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="flat" onPress={handleSelectAll}>
                    Select All
                  </Button>
                  <Button size="sm" variant="flat" onPress={handleDeselectAll}>
                    Deselect All
                  </Button>
                  <div className="ml-auto text-xs text-secondary self-center">
                    {userTrustedVaults.length} / {allAvailableVaults.length} selected
                  </div>
                </div>
              </div>

              <Divider />

              <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
                <h3 className="font-zen text-base font-semibold text-primary">
                  Known Vaults ({sortedMonarchVaults.length})
                </h3>
                {sortedMonarchVaults.length === 0 ? (
                  <div className="text-center text-sm text-secondary py-4">
                    No known vaults found matching your search.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sortedMonarchVaults.map((vault) => {
                      const trusted = isVaultTrusted(vault);

                      return (
                        <div
                          key={`monarch-${vault.address}-${vault.chainId}`}
                          className="flex items-center justify-between gap-4 rounded bg-surface p-3 transition-colors hover:bg-surface-dark"
                        >
                          <div className="flex flex-grow items-center gap-3">
                            <NetworkIcon networkId={vault.chainId} />
                            <VaultIdentity
                              address={vault.address as `0x${string}`}
                              asset={vault.asset}
                              chainId={vault.chainId}
                              curator={vault.curator}
                              vaultName={vault.name}
                              showLink
                              variant="inline"
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

              <div className="bg-surface-soft flex flex-col gap-3 rounded p-4">
                <button
                  type="button"
                  className="flex items-center justify-between text-left text-sm font-semibold text-primary"
                  onClick={() => setMorphoSectionOpen((prev) => !prev)}
                >
                  <span>All Morpho Vaults ({sortedMorphoVaults.length})</span>
                  {morphoSectionOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
                {morphoSectionOpen && (
                  morphoLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner size="sm" label="Loading Morpho vaults..." />
                    </div>
                  ) : sortedMorphoVaults.length === 0 ? (
                    <div className="text-center text-sm text-secondary py-4">
                      {searchQuery.trim()
                        ? 'No Morpho vaults found matching your search.'
                        : 'All Morpho vaults are already in the known list.'}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sortedMorphoVaults.map((vault) => {
                        const trusted = isVaultTrusted(vault);

                        return (
                          <div
                            key={`morpho-${vault.address}-${vault.chainId}`}
                            className="flex items-center justify-between gap-4 rounded bg-surface p-3 transition-colors hover:bg-surface-dark"
                          >
                            <div className="flex flex-grow items-center gap-3">
                              <NetworkIcon networkId={vault.chainId} />
                              <VaultIdentity
                                address={vault.address as `0x${string}`}
                                asset={vault.asset}
                                chainId={vault.chainId}
                                curator={vault.curator}
                                vaultName={vault.name}
                                showLink
                                variant="inline"
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
                  )
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onPress={onClose} size="sm">
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
