'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { NetworkIcon } from '@/components/shared/network-icon';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { VaultVersionBadge } from '@/features/autovault/components/vault-version-badge';
import { getVaultKey, monarch_suggested_vaults, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useListedMorphoVaultV2MetadataQuery } from '@/hooks/queries/useMorphoVaultV2MetadataQuery';
import { buildEffectiveTrustedVaults } from '@/hooks/useEffectiveTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { cn } from '@/utils';
import {
  buildTrustedVaultMap,
  buildTrustedVaultMetadata,
  isTrustedVaultV2,
  morphoVaultToTrustedVault,
  morphoVaultV2MetadataToTrustedVault,
} from '@/utils/vaults';

type VaultActionState = 'add' | 'included' | 'remove';

type VaultSelectionRowProps = {
  vault: TrustedVault;
  actionState: VaultActionState;
  onAdd: () => void;
  onRemove: () => void;
};

type BrowseVaultsContentProps = {
  isLoading: boolean;
  loadingLabel?: string;
  vaults: TrustedVault[];
  searchQuery: string;
  getActionState: (vault: TrustedVault) => VaultActionState;
  addVault: (vault: TrustedVault) => void;
  removeVault: (vault: TrustedVault) => void;
};

type TrustedByColumnToggleProps = {
  selected: boolean;
  onChange: (visible: boolean) => void;
  className?: string;
};

const vaultKey = (vault: TrustedVault) => getVaultKey(vault.address, vault.chainId);

const MONARCH_SUGGESTED_VAULT_KEYS = new Set(monarch_suggested_vaults.map(vaultKey));

const isMonarchSuggestedVault = (vault: TrustedVault) => MONARCH_SUGGESTED_VAULT_KEYS.has(vaultKey(vault));

function TrustedByColumnToggle({ selected, onChange, className }: TrustedByColumnToggleProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">Show Trusted By column</p>
        <p className="mt-1 text-xs text-secondary">
          Turns on the Trusted By column in Markets view, where trusted-vault deposits are highlighted.
        </p>
      </div>
      <IconSwitch
        selected={selected}
        onChange={onChange}
        size="xs"
        color="primary"
        aria-label="Toggle Trusted By column"
        className="shrink-0"
      />
    </div>
  );
}

function VaultRowIdentity({ vault }: { vault: TrustedVault }) {
  return (
    <div className="flex min-w-0 flex-grow items-center gap-2.5">
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
  );
}

function VaultSelectionRow({ vault, actionState, onAdd, onRemove }: VaultSelectionRowProps) {
  const isActive = actionState !== 'add';
  const buttonLabel = actionState === 'add' ? 'Add' : actionState === 'remove' ? 'Remove' : 'Included';
  const ariaLabel =
    actionState === 'add'
      ? `Add ${vault.name} to trusted vaults`
      : actionState === 'remove'
        ? `Remove ${vault.name} from trusted vaults`
        : `${vault.name} is included by the Monarch list`;

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3 px-2.5 py-2.5 transition-colors hover:bg-surface-dark',
        isActive ? 'bg-primary/5' : 'bg-surface-soft',
      )}
    >
      <VaultRowIdentity vault={vault} />
      <Button
        size="xs"
        variant={actionState === 'add' ? 'default' : 'ghost'}
        onClick={actionState === 'remove' ? onRemove : onAdd}
        disabled={actionState === 'included'}
        className="w-[5.5rem] shrink-0"
        aria-label={ariaLabel}
      >
        {actionState === 'included' ? (
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="h-3.5 w-3.5" />
            Included
          </span>
        ) : actionState === 'remove' ? (
          <span className="inline-flex items-center gap-1">
            <Cross2Icon className="h-3.5 w-3.5" />
            Remove
          </span>
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  );
}

function BrowseVaultsContent({
  isLoading,
  loadingLabel = 'Loading vaults',
  vaults,
  searchQuery,
  getActionState,
  addVault,
  removeVault,
}: BrowseVaultsContentProps) {
  if (isLoading) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2">
        <Spinner size={24} />
        <span className="text-xs text-secondary">{loadingLabel}</span>
      </div>
    );
  }

  if (vaults.length === 0) {
    const message = searchQuery.trim() ? 'No vaults match your search.' : 'No Morpho-listed vaults found.';
    return <p className="flex h-40 items-center justify-center text-center text-xs text-secondary">{message}</p>;
  }

  return (
    <div className="divide-y divide-border">
      {vaults.map((vault) => (
        <VaultSelectionRow
          key={`browse-${vault.address}-${vault.chainId}`}
          vault={vault}
          actionState={getActionState(vault)}
          onAdd={() => addVault(vault)}
          onRemove={() => removeVault(vault)}
        />
      ))}
    </div>
  );
}

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

const sortVaults = <T extends TrustedVault>(vaults: T[]): T[] => {
  return [...vaults].sort((a, b) => {
    const featuredScore = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredScore !== 0) return featuredScore;
    return a.name.localeCompare(b.name);
  });
};

const matchesVaultSearch = (vault: TrustedVault, searchQuery: string) => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return vault.name.toLowerCase().includes(query) || vault.address.toLowerCase().includes(query);
};

export function TrustedVaultsDetail() {
  const { columnVisibility, setColumnVisibility } = useMarketPreferences();
  const {
    vaults: userTrustedVaults,
    includeMonarchSuggestedVaults,
    setVaults: setUserTrustedVaults,
    setIncludeMonarchSuggestedVaults,
  } = useTrustedVaults();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'browse' | 'overview'>('overview');
  const [browsePriorityVaultKeys, setBrowsePriorityVaultKeys] = useState<string[]>([]);

  const { data: morphoVaults = [], isLoading: morphoLoading } = useAllMorphoVaultsQuery();
  const { data: morphoV2VaultMetadata = [], isLoading: morphoV2MetadataLoading } = useListedMorphoVaultV2MetadataQuery();
  const v2Vaults = useMemo(() => morphoV2VaultMetadata.map(morphoVaultV2MetadataToTrustedVault), [morphoV2VaultMetadata]);

  const mergedVaults = useMemo(() => buildTrustedVaultMetadata(morphoVaults, v2Vaults), [morphoVaults, v2Vaults]);
  const mergedVaultsByKey = useMemo(() => new Map(mergedVaults.map((vault) => [vaultKey(vault), vault])), [mergedVaults]);
  const suggestedVaults = useMemo(() => {
    return sortVaults(Array.from(buildTrustedVaultMap(monarch_suggested_vaults, mergedVaults).values()));
  }, [mergedVaults]);

  const browseVaults = useMemo<TrustedVault[]>(() => {
    const vaultsByKey = new Map<string, TrustedVault>();

    for (const morphoVault of morphoVaults) {
      const vault = morphoVaultToTrustedVault(morphoVault);
      addBrowseVault(vaultsByKey, mergedVaultsByKey.get(vaultKey(vault)) ?? vault);
    }

    for (const vault of v2Vaults) {
      const key = vaultKey(vault);
      addBrowseVault(vaultsByKey, mergedVaultsByKey.get(key) ?? vault);
    }

    return Array.from(vaultsByKey.values());
  }, [mergedVaultsByKey, morphoVaults, v2Vaults]);

  const userTrustedVaultKeys = useMemo(() => new Set(userTrustedVaults.map(vaultKey)), [userTrustedVaults]);
  const effectiveTrustedVaults = useMemo(
    () => buildEffectiveTrustedVaults(userTrustedVaults, includeMonarchSuggestedVaults),
    [includeMonarchSuggestedVaults, userTrustedVaults],
  );
  const browsePriorityVaultKeySet = useMemo(() => new Set(browsePriorityVaultKeys), [browsePriorityVaultKeys]);
  const customTrustedVaults = useMemo(() => {
    if (!includeMonarchSuggestedVaults) {
      return userTrustedVaults;
    }
    return userTrustedVaults.filter((vault) => !isMonarchSuggestedVault(vault));
  }, [includeMonarchSuggestedVaults, userTrustedVaults]);
  const sortedCustomTrustedVaults = useMemo(() => {
    return sortVaults(Array.from(buildTrustedVaultMap(customTrustedVaults, mergedVaults).values()));
  }, [customTrustedVaults, mergedVaults]);
  const filteredBrowseVaults = useMemo(() => {
    const vaults = sortVaults(browseVaults.filter((vault) => matchesVaultSearch(vault, searchQuery)));
    if (browsePriorityVaultKeySet.size === 0) {
      return vaults;
    }

    // Snapshot priority at edit entry so add/remove clicks do not make rows jump.
    return vaults.sort((a, b) => {
      const aPriority = Number(browsePriorityVaultKeySet.has(vaultKey(a)));
      const bPriority = Number(browsePriorityVaultKeySet.has(vaultKey(b)));
      return bPriority - aPriority;
    });
  }, [browsePriorityVaultKeySet, browseVaults, searchQuery]);

  const isVaultDiscoveryLoading = morphoLoading || morphoV2MetadataLoading;
  const hasTrustedVaultSetup = effectiveTrustedVaults.length > 0;
  const monarchListDescription = [
    `Monarch maintains a default vault list (${suggestedVaults.length} vaults) selected for conservative, relatively low-risk profiles.`,
    'Turn on to keep it synced as Monarch updates the app.',
  ].join(' ');
  const customVaultsLabel =
    sortedCustomTrustedVaults.length === 0
      ? 'No custom vaults added.'
      : `${sortedCustomTrustedVaults.length} custom vault${sortedCustomTrustedVaults.length === 1 ? '' : 's'} added.`;

  const setTrustedByColumnVisible = (visible: boolean) => {
    setColumnVisibility((previous) => ({
      ...previous,
      trustedBy: visible,
    }));
  };

  const setMonarchSuggestedVaultsEnabled = (enabled: boolean) => {
    if (enabled) {
      setTrustedByColumnVisible(true);
    }
    setIncludeMonarchSuggestedVaults(enabled);
  };

  const openBrowseView = () => {
    setBrowsePriorityVaultKeys(effectiveTrustedVaults.map(vaultKey));
    setView('browse');
  };

  const addVault = (vault: TrustedVault) => {
    if (userTrustedVaultKeys.has(vaultKey(vault))) return;
    setUserTrustedVaults([...userTrustedVaults, vault]);
  };

  const removeVault = (vault: TrustedVault) => {
    const targetKey = vaultKey(vault);
    setUserTrustedVaults(userTrustedVaults.filter((v) => vaultKey(v) !== targetKey));
  };

  const getVaultActionState = (vault: TrustedVault): VaultActionState => {
    if (includeMonarchSuggestedVaults && isMonarchSuggestedVault(vault)) {
      return 'included';
    }
    if (userTrustedVaultKeys.has(vaultKey(vault))) {
      return 'remove';
    }
    return 'add';
  };

  if (view === 'browse') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded bg-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setView('overview')}
                className="inline-flex w-fit items-center gap-1 text-xs text-secondary transition-colors hover:text-primary"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Trusted vaults
              </button>
              <div>
                <h3 className="text-xs uppercase text-primary">Add custom vaults</h3>
                <p className="mt-1 text-xs text-secondary">Search Morpho-listed v1 and v2 vaults.</p>
              </div>
            </div>
            <p className="text-xs text-secondary">{isVaultDiscoveryLoading ? 'Loading' : `${filteredBrowseVaults.length} shown`}</p>
          </div>

          <Input
            placeholder="Search vaults"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            className="w-full font-zen"
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 border-b border-border bg-surface-soft px-2.5 py-2 text-[10px] uppercase text-secondary">
              <span>Vault</span>
              <span className="text-right">Action</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BrowseVaultsContent
                isLoading={isVaultDiscoveryLoading}
                loadingLabel="Loading Morpho vaults"
                vaults={filteredBrowseVaults}
                searchQuery={searchQuery}
                getActionState={getVaultActionState}
                addVault={addVault}
                removeVault={removeVault}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <h3 className="text-xs uppercase text-primary">Trusted vaults</h3>
            <p className="text-xs text-secondary">
              Set vaults you trust. Deposits from these vaults are highlighted in each market's Trusted By column.
            </p>
          </div>
          {hasTrustedVaultSetup && (
            <Button
              size="xs"
              variant="default"
              onClick={openBrowseView}
              className="shrink-0"
            >
              Edit
            </Button>
          )}
        </div>

        {hasTrustedVaultSetup ? null : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">Use default Monarch list</p>
                <p className="mt-1 text-xs text-secondary">{monarchListDescription}</p>
              </div>
              <IconSwitch
                selected={includeMonarchSuggestedVaults}
                onChange={setMonarchSuggestedVaultsEnabled}
                size="xs"
                color="primary"
                aria-label="Toggle Monarch suggested vault list"
                className="shrink-0"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={openBrowseView}
              className="w-fit text-secondary hover:text-primary"
            >
              Edit manually
            </Button>
          </div>
        )}

        {hasTrustedVaultSetup ? null : (
          <TrustedByColumnToggle
            selected={columnVisibility.trustedBy}
            onChange={setTrustedByColumnVisible}
            className="border-t border-border pt-4"
          />
        )}
      </div>

      {hasTrustedVaultSetup ? (
        <div className="flex flex-col gap-4 rounded bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">Use default Monarch list</p>
              <p className="mt-1 text-xs text-secondary">{monarchListDescription}</p>
            </div>
            <IconSwitch
              selected={includeMonarchSuggestedVaults}
              onChange={setMonarchSuggestedVaultsEnabled}
              size="xs"
              color="primary"
              aria-label="Toggle Monarch suggested vault list"
              className="shrink-0"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">Custom additions</p>
              <p className="mt-1 text-xs text-secondary">{customVaultsLabel}</p>
            </div>
          </div>

          <TrustedByColumnToggle
            selected={columnVisibility.trustedBy}
            onChange={setTrustedByColumnVisible}
          />
        </div>
      ) : null}
    </div>
  );
}
