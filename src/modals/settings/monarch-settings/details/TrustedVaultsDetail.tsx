'use client';

import { useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon, Cross2Icon } from '@radix-ui/react-icons';
import { IoWarningOutline } from 'react-icons/io5';
import { useAppSettings } from '@/stores/useAppSettings';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NetworkIcon } from '@/components/shared/network-icon';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { VaultVersionBadge } from '@/features/autovault/components/vault-version-badge';
import { getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useListedMorphoVaultV2MetadataQuery } from '@/hooks/queries/useMorphoVaultV2MetadataQuery';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import {
  buildTrustedVaultMap,
  buildTrustedVaultMetadata,
  isTrustedVaultV2,
  morphoVaultToTrustedVault,
  morphoVaultV2MetadataToTrustedVault,
} from '@/utils/vaults';

type AddVaultRowProps = {
  vault: TrustedVault;
  trusted: boolean;
  onAdd: () => void;
};

type TrustedVaultRowProps = {
  vault: TrustedVault;
  onRemove: () => void;
};

function TrustedVaultRow({ vault, onRemove }: TrustedVaultRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded bg-surface-soft p-2.5 transition-colors hover:bg-surface-dark">
      <div className="flex flex-grow items-center gap-2.5 min-w-0">
        <NetworkIcon networkId={vault.chainId} />
        <VaultIdentity
          address={vault.address as `0x${string}`}
          asset={vault.asset}
          chainId={vault.chainId}
          description={vault.metadataDescription}
          imageSrc={vault.metadataImage}
          vaultName={vault.name}
          showLink={isTrustedVaultV2(vault)}
          variant="inline"
        />
        <VaultVersionBadge vault={vault} />
      </div>
      <Button
        size="xs"
        variant="ghost"
        onClick={onRemove}
        aria-label={`Remove ${vault.name} from trusted vaults`}
      >
        <Cross2Icon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AddVaultRow({ vault, trusted, onAdd }: AddVaultRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded bg-surface-soft p-2.5 transition-colors hover:bg-surface-dark">
      <div className="flex flex-grow items-center gap-2.5 min-w-0">
        <NetworkIcon networkId={vault.chainId} />
        <VaultIdentity
          address={vault.address as `0x${string}`}
          asset={vault.asset}
          chainId={vault.chainId}
          description={vault.metadataDescription}
          imageSrc={vault.metadataImage}
          vaultName={vault.name}
          showLink={isTrustedVaultV2(vault)}
          variant="inline"
        />
        <VaultVersionBadge vault={vault} />
      </div>
      <Button
        size="xs"
        variant={trusted ? 'ghost' : 'default'}
        onClick={onAdd}
        disabled={trusted}
        className="w-16 shrink-0"
      >
        {trusted ? (
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="h-3.5 w-3.5" />
            Selected
          </span>
        ) : (
          'Add'
        )}
      </Button>
    </div>
  );
}

type SourceVaultsContentProps = {
  isLoading: boolean;
  loadingLabel?: string;
  vaults: TrustedVault[];
  searchQuery: string;
  emptyLabel: string;
  noMatchesLabel: string;
  isVaultTrusted: (vault: TrustedVault) => boolean;
  addVault: (vault: TrustedVault) => void;
};

function SourceVaultsContent({
  isLoading,
  loadingLabel = 'Loading vaults',
  vaults,
  searchQuery,
  emptyLabel,
  noMatchesLabel,
  isVaultTrusted,
  addVault,
}: SourceVaultsContentProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <Spinner size={24} />
        <span className="text-xs text-secondary">{loadingLabel}</span>
      </div>
    );
  }

  if (vaults.length === 0) {
    const message = searchQuery.trim() ? noMatchesLabel : emptyLabel;
    return <p className="py-2 text-center text-xs text-secondary">{message}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {vaults.map((vault) => (
        <AddVaultRow
          key={`browse-${vault.address}-${vault.chainId}`}
          vault={vault}
          trusted={isVaultTrusted(vault)}
          onAdd={() => addVault(vault)}
        />
      ))}
    </div>
  );
}

const vaultKey = (v: TrustedVault) => getVaultKey(v.address, v.chainId);

const addBrowseVault = (vaultsByKey: Map<string, TrustedVault>, vault: TrustedVault) => {
  const key = vaultKey(vault);
  const existing = vaultsByKey.get(key);
  if (!existing) {
    vaultsByKey.set(key, vault);
    return;
  }

  vaultsByKey.set(key, {
    ...existing,
    featured: existing.featured ?? vault.featured,
    metadataDescription: existing.metadataDescription ?? vault.metadataDescription,
    metadataImage: existing.metadataImage ?? vault.metadataImage,
  });
};

export function TrustedVaultsDetail() {
  const { vaults: userTrustedVaults, setVaults: setUserTrustedVaults } = useTrustedVaults();
  const { trustedVaultsWarningDismissed, setTrustedVaultsWarningDismissed } = useAppSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [trustedVaultsOpen, setTrustedVaultsOpen] = useState(false);

  const { data: morphoVaults = [], isLoading: morphoLoading } = useAllMorphoVaultsQuery();
  const { data: morphoV2VaultMetadata = [], isLoading: morphoV2MetadataLoading } = useListedMorphoVaultV2MetadataQuery();
  const v2Vaults = useMemo(() => morphoV2VaultMetadata.map(morphoVaultV2MetadataToTrustedVault), [morphoV2VaultMetadata]);

  const mergedVaults = useMemo(() => buildTrustedVaultMetadata(morphoVaults, v2Vaults), [morphoVaults, v2Vaults]);
  const mergedVaultsByKey = useMemo(() => new Map(mergedVaults.map((vault) => [vaultKey(vault), vault])), [mergedVaults]);

  const browseVaults = useMemo<TrustedVault[]>(() => {
    const vaultsByKey = new Map<string, TrustedVault>();

    for (const morphoVault of morphoVaults) {
      const vault = morphoVaultToTrustedVault(morphoVault);
      addBrowseVault(vaultsByKey, {
        ...(mergedVaultsByKey.get(vaultKey(vault)) ?? vault),
        source: 'morpho',
      });
    }

    for (const vault of v2Vaults) {
      const key = vaultKey(vault);
      addBrowseVault(vaultsByKey, {
        ...(mergedVaultsByKey.get(key) ?? vault),
        source: 'morpho',
      });
    }

    return Array.from(vaultsByKey.values());
  }, [mergedVaultsByKey, morphoVaults, v2Vaults]);

  const browseVaultsByKey = useMemo(() => new Map(browseVaults.map((vault) => [vaultKey(vault), vault])), [browseVaults]);
  const trustedVaultKeys = useMemo(() => new Set(userTrustedVaults.map(vaultKey)), [userTrustedVaults]);

  const isVaultTrusted = (vault: TrustedVault) => trustedVaultKeys.has(vaultKey(vault));

  const matchesSearch = (vault: TrustedVault) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return vault.name.toLowerCase().includes(query) || vault.address.toLowerCase().includes(query);
  };

  const sortVaults = <T extends TrustedVault>(vaults: T[]): T[] => {
    return [...vaults].sort((a, b) => {
      const featuredScore = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredScore !== 0) return featuredScore;
      return a.name.localeCompare(b.name);
    });
  };

  const enrichedTrustedVaults = useMemo(() => {
    return Array.from(buildTrustedVaultMap(userTrustedVaults, mergedVaults).values()).map((vault) => {
      const browseVault = browseVaultsByKey.get(vaultKey(vault));
      return browseVault
        ? {
            ...vault,
            metadataDescription: browseVault.metadataDescription ?? vault.metadataDescription,
            metadataImage: browseVault.metadataImage ?? vault.metadataImage,
          }
        : vault;
    });
  }, [userTrustedVaults, mergedVaults, browseVaultsByKey]);

  const sortedTrustedVaults = useMemo(() => {
    return [...enrichedTrustedVaults].sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedTrustedVaults]);

  const filteredBrowseVaults = useMemo(() => {
    return sortVaults(browseVaults.filter(matchesSearch));
  }, [browseVaults, searchQuery]);

  const visibleNewCount = useMemo(
    () => filteredBrowseVaults.filter((vault) => !trustedVaultKeys.has(vaultKey(vault))).length,
    [filteredBrowseVaults, trustedVaultKeys],
  );
  const isVaultDiscoveryLoading = morphoLoading || morphoV2MetadataLoading;

  const addVault = (vault: TrustedVault) => {
    if (isVaultTrusted(vault)) return;
    setUserTrustedVaults([...userTrustedVaults, vault]);
  };

  const removeVault = (vault: TrustedVault) => {
    const targetKey = vaultKey(vault);
    setUserTrustedVaults(userTrustedVaults.filter((v) => vaultKey(v) !== targetKey));
  };

  const addVaultsToTrustedList = (vaults: TrustedVault[]) => {
    const vaultsByKey = new Map(userTrustedVaults.map((vault) => [vaultKey(vault), vault]));
    for (const vault of vaults) {
      vaultsByKey.set(vaultKey(vault), vault);
    }
    setUserTrustedVaults(Array.from(vaultsByKey.values()));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs uppercase text-secondary">Trusted vaults</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-primary">{userTrustedVaults.length} selected</p>
              {userTrustedVaults.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTrustedVaultsOpen((open) => !open)}
                  className="inline-flex h-5 items-center gap-1 rounded px-1 text-xs text-secondary transition-colors hover:bg-surface-soft hover:text-primary"
                  aria-expanded={trustedVaultsOpen}
                  aria-label={trustedVaultsOpen ? 'Hide selected trusted vaults' : 'Show selected trusted vaults'}
                >
                  {trustedVaultsOpen ? 'Hide' : 'Show'}
                  <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${trustedVaultsOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            <p className="text-xs text-secondary">Used by Trusted By columns.</p>
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setUserTrustedVaults([])}
            disabled={userTrustedVaults.length === 0}
            className="shrink-0 text-secondary hover:text-primary"
            aria-label="Remove all trusted vaults"
          >
            Remove all
          </Button>
        </div>

        {!trustedVaultsWarningDismissed && (
          <div className="flex items-start gap-3 rounded bg-yellow-500/10 p-3 text-yellow-700 dark:text-yellow-500">
            <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-xs">
              <span className="font-medium">Display only.</span> This list changes market views, not approvals or protocol risk.
            </p>
            <button
              type="button"
              onClick={() => setTrustedVaultsWarningDismissed(true)}
              className="shrink-0 text-yellow-700/60 hover:text-yellow-700 dark:text-yellow-500/60 dark:hover:text-yellow-500 transition-colors"
              aria-label="Dismiss warning"
            >
              <Cross2Icon className="h-4 w-4" />
            </button>
          </div>
        )}

        {userTrustedVaults.length === 0 ? (
          <p className="py-1 text-xs text-secondary">Add vaults below.</p>
        ) : trustedVaultsOpen ? (
          <div className="flex flex-col gap-1.5">
            {sortedTrustedVaults.map((vault) => (
              <TrustedVaultRow
                key={`trusted-${vault.address}-${vault.chainId}`}
                vault={vault}
                onRemove={() => removeVault(vault)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs uppercase text-secondary">Add vaults</h3>
            <p className="text-xs text-secondary">Choose from Morpho-listed vaults.</p>
          </div>
          <Button
            size="xs"
            variant="default"
            onClick={() => addVaultsToTrustedList(filteredBrowseVaults)}
            disabled={isVaultDiscoveryLoading || visibleNewCount === 0}
            className="w-28 shrink-0 self-start"
          >
            {isVaultDiscoveryLoading ? (
              'Loading'
            ) : filteredBrowseVaults.length === 0 ? (
              'None'
            ) : visibleNewCount === 0 ? (
              <span className="inline-flex items-center gap-1">
                <CheckIcon className="h-3.5 w-3.5" />
                Added
              </span>
            ) : (
              'Add all'
            )}
          </Button>
        </div>

        <Input
          placeholder="Search vaults"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          className="w-full font-zen"
        />

        <SourceVaultsContent
          isLoading={isVaultDiscoveryLoading}
          loadingLabel="Loading Morpho vaults"
          vaults={filteredBrowseVaults}
          searchQuery={searchQuery}
          emptyLabel="No Morpho-listed vaults found."
          noMatchesLabel="No vaults match your search."
          isVaultTrusted={isVaultTrusted}
          addVault={addVault}
        />
      </div>
    </div>
  );
}
