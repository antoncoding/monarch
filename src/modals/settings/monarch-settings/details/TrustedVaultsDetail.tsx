'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { GoShield, GoShieldCheck } from 'react-icons/go';
import { IoWarningOutline } from 'react-icons/io5';
import { Spinner } from '@/components/ui/spinner';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { NetworkIcon } from '@/components/shared/network-icon';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { known_vaults, type KnownVault, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useTrustedVaults } from '@/stores/useTrustedVaults';

type VaultRowProps = {
  vault: KnownVault;
  trusted: boolean;
  onToggle: () => void;
  keyPrefix: string;
};

function VaultRow({ vault, trusted, onToggle, keyPrefix }: VaultRowProps) {
  return (
    <div
      key={`${keyPrefix}-${vault.address}-${vault.chainId}`}
      className="flex items-center justify-between gap-4 rounded bg-surface p-2.5 transition-colors hover:bg-surface-dark"
    >
      <div className="flex flex-grow items-center gap-2.5">
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
        onChange={onToggle}
        size="xs"
        color="primary"
        thumbIcon={trusted ? GoShieldCheck : GoShield}
        aria-label={`Toggle trust for ${vault.name}`}
      />
    </div>
  );
}

const getVaultKey = (v: KnownVault) => `${v.address.toLowerCase()}-${v.chainId}`;

export function TrustedVaultsDetail() {
  const { vaults: userTrustedVaults, setVaults: setUserTrustedVaults } = useTrustedVaults();
  const [searchQuery, setSearchQuery] = useState('');
  const [morphoSectionOpen, setMorphoSectionOpen] = useState(false);

  const { data: morphoVaults = [], isLoading: morphoLoading } = useAllMorphoVaultsQuery();

  const morphoWhitelistedVaults = useMemo<KnownVault[]>(() => {
    return morphoVaults.map((vault) => ({
      address: vault.address as `0x${string}`,
      chainId: vault.chainId,
      name: vault.name,
      curator: 'unknown',
      asset: vault.assetAddress as `0x${string}`,
    }));
  }, [morphoVaults]);

  const monarchVaultKeys = useMemo(() => new Set(known_vaults.map(getVaultKey)), []);

  const allAvailableVaults = useMemo<KnownVault[]>(() => {
    const uniqueMorphoVaults = morphoWhitelistedVaults.filter((v) => !monarchVaultKeys.has(getVaultKey(v)));
    return [...known_vaults, ...uniqueMorphoVaults];
  }, [morphoWhitelistedVaults, monarchVaultKeys]);

  const filterAndSortVaults = (vaults: KnownVault[]) => {
    let filtered = vaults;

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

    return [...filtered].sort((a, b) => {
      const defaultScore = Number(Boolean(b.defaultTrusted)) - Number(Boolean(a.defaultTrusted));
      if (defaultScore !== 0) return defaultScore;

      const curatorCompare = a.curator.localeCompare(b.curator);
      if (curatorCompare !== 0) return curatorCompare;
      return a.name.localeCompare(b.name);
    });
  };

  const sortedMonarchVaults = useMemo(() => {
    return filterAndSortVaults(known_vaults);
  }, [searchQuery]);

  const sortedMorphoVaults = useMemo(() => {
    const uniqueMorphoVaults = morphoWhitelistedVaults.filter((v) => !monarchVaultKeys.has(getVaultKey(v)));
    return filterAndSortVaults(uniqueMorphoVaults);
  }, [morphoWhitelistedVaults, monarchVaultKeys, searchQuery]);

  const isVaultTrusted = (vault: TrustedVault | KnownVault) => {
    return userTrustedVaults.some((v) => v.address.toLowerCase() === vault.address.toLowerCase() && v.chainId === vault.chainId);
  };

  const formatVaultForStorage = (vault: KnownVault): TrustedVault => ({
    address: vault.address,
    chainId: vault.chainId,
    curator: vault.curator,
    name: vault.name,
    asset: vault.asset,
  });

  const toggleVault = (vault: KnownVault) => {
    const targetAddress = vault.address.toLowerCase();
    const exists = userTrustedVaults.some((v) => v.chainId === vault.chainId && v.address.toLowerCase() === targetAddress);

    if (exists) {
      setUserTrustedVaults(userTrustedVaults.filter((v) => !(v.chainId === vault.chainId && v.address.toLowerCase() === targetAddress)));
    } else {
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
    <div className="flex flex-col gap-4">
      {/* Info Section */}
      <div className="flex items-start gap-3 rounded bg-yellow-500/10 p-3 text-yellow-700 dark:text-yellow-500">
        <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs">
          Vaults are managed by third-party curators. Markets trusted by those vaults are not guaranteed to be risk-free. Always do your own
          research before trusting any vault.
        </p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search by name, curator, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          className="w-full font-zen"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeselectAll}
          >
            Deselect All
          </Button>
          <div className="ml-auto self-center text-[11px] text-secondary">
            {userTrustedVaults.length} / {allAvailableVaults.length} selected
          </div>
        </div>
      </div>

      <Divider />

      {/* Known Vaults */}
      <div className="flex flex-col gap-3 rounded bg-surface-soft py-3">
        <h3 className="text-sm font-normal text-primary">Known Vaults ({sortedMonarchVaults.length})</h3>
        {sortedMonarchVaults.length === 0 ? (
          <div className="py-4 text-center text-xs text-secondary">No known vaults found matching your search.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortedMonarchVaults.map((vault) => (
              <VaultRow
                key={`monarch-${vault.address}-${vault.chainId}`}
                vault={vault}
                trusted={isVaultTrusted(vault)}
                onToggle={() => toggleVault(vault)}
                keyPrefix="monarch"
              />
            ))}
          </div>
        )}
      </div>

      {/* All Morpho Vaults (Collapsible) */}
      <div className="flex flex-col gap-3 rounded bg-surface-soft p-3">
        <button
          type="button"
          className="flex items-center justify-between text-left text-sm font-medium text-primary"
          onClick={() => setMorphoSectionOpen((prev) => !prev)}
        >
          <span>All Morpho Vaults ({sortedMorphoVaults.length})</span>
          {morphoSectionOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
        {morphoSectionOpen &&
          (morphoLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <Spinner size={24} />
              <span className="text-xs text-secondary">Loading Morpho vaults...</span>
            </div>
          ) : sortedMorphoVaults.length === 0 ? (
            <div className="py-4 text-center text-xs text-secondary">
              {searchQuery.trim() ? 'No Morpho vaults found matching your search.' : 'All Morpho vaults are already in the known list.'}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sortedMorphoVaults.map((vault) => (
                <VaultRow
                  key={`morpho-${vault.address}-${vault.chainId}`}
                  vault={vault}
                  trusted={isVaultTrusted(vault)}
                  onToggle={() => toggleVault(vault)}
                  keyPrefix="morpho"
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
