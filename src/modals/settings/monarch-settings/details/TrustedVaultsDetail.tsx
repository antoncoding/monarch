'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, Cross2Icon } from '@radix-ui/react-icons';
import { GoShield, GoShieldCheck } from 'react-icons/go';
import { IoWarningOutline } from 'react-icons/io5';
import { useAppSettings } from '@/stores/useAppSettings';
import { Spinner } from '@/components/ui/spinner';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { NetworkIcon } from '@/components/shared/network-icon';
import { VaultIdentity } from '@/features/autovault/components/vault-identity';
import { getVaultKey, known_vaults, type KnownVault, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useTrustedVaults } from '@/stores/useTrustedVaults';

type TrustedVaultRowProps = {
  vault: TrustedVault;
  onRemove: () => void;
};

function TrustedVaultRow({ vault, onRemove }: TrustedVaultRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-surface-soft p-2 transition-colors hover:bg-surface-dark">
      <div className="flex flex-grow items-center gap-2.5 min-w-0">
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
      <Button
        size="xs"
        variant={'ghost'}
        onClick={onRemove}
        aria-label={`Remove ${vault.name} from trusted`}
      >
        <Cross2Icon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

type AddVaultRowProps = {
  vault: KnownVault;
  trusted: boolean;
  onToggle: () => void;
};

function AddVaultRow({ vault, trusted, onToggle }: AddVaultRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded bg-surface-soft p-2.5 transition-colors hover:bg-surface-dark">
      <div className="flex flex-grow items-center gap-2.5 min-w-0">
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

type CollapsibleSectionProps = {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function CollapsibleSection({ title, count, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-medium text-primary">
          {title} ({count})
        </span>
        {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {isOpen && children}
    </div>
  );
}

type AllVaultsContentProps = {
  isLoading: boolean;
  vaults: KnownVault[];
  searchQuery: string;
  isVaultTrusted: (vault: KnownVault) => boolean;
  toggleVault: (vault: KnownVault) => void;
};

function AllVaultsContent({ isLoading, vaults, searchQuery, isVaultTrusted, toggleVault }: AllVaultsContentProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <Spinner size={24} />
        <span className="text-xs text-secondary">Loading Morpho vaults...</span>
      </div>
    );
  }

  if (vaults.length === 0) {
    const message = searchQuery.trim() ? 'No vaults match your search.' : 'All vaults are in the known list.';
    return <p className="py-2 text-center text-xs text-secondary">{message}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {vaults.map((vault) => (
        <AddVaultRow
          key={`morpho-${vault.address}-${vault.chainId}`}
          vault={vault}
          trusted={isVaultTrusted(vault)}
          onToggle={() => toggleVault(vault)}
        />
      ))}
    </div>
  );
}

const vaultKey = (v: KnownVault | TrustedVault) => getVaultKey(v.address, v.chainId);

export function TrustedVaultsDetail() {
  const { vaults: userTrustedVaults, setVaults: setUserTrustedVaults } = useTrustedVaults();
  const { trustedVaultsWarningDismissed, setTrustedVaultsWarningDismissed } = useAppSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [myVaultsOpen, setMyVaultsOpen] = useState(true);
  const [knownVaultsOpen, setKnownVaultsOpen] = useState(false);
  const [allVaultsOpen, setAllVaultsOpen] = useState(false);

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

  const monarchVaultKeys = useMemo(() => new Set(known_vaults.map(vaultKey)), []);
  const trustedVaultKeys = useMemo(() => new Set(userTrustedVaults.map(vaultKey)), [userTrustedVaults]);

  const isVaultTrusted = (vault: KnownVault) => trustedVaultKeys.has(vaultKey(vault));

  // Filter helper for search (only used in Add Vaults section)
  const matchesSearch = (vault: KnownVault) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      vault.name.toLowerCase().includes(query) || vault.curator.toLowerCase().includes(query) || vault.address.toLowerCase().includes(query)
    );
  };

  // Sort helper: defaultTrusted first, then by curator, then name
  const sortVaults = <T extends KnownVault>(vaults: T[]): T[] => {
    return [...vaults].sort((a, b) => {
      const defaultScore = Number(Boolean(b.defaultTrusted)) - Number(Boolean(a.defaultTrusted));
      if (defaultScore !== 0) return defaultScore;
      const curatorCompare = a.curator.localeCompare(b.curator);
      if (curatorCompare !== 0) return curatorCompare;
      return a.name.localeCompare(b.name);
    });
  };

  // My Vaults: sorted by curator then name (NO search filter)
  const sortedTrustedVaults = useMemo(() => {
    return [...userTrustedVaults].sort((a, b) => {
      const curatorCompare = a.curator.localeCompare(b.curator);
      if (curatorCompare !== 0) return curatorCompare;
      return a.name.localeCompare(b.name);
    });
  }, [userTrustedVaults]);

  // Known Vaults: filtered by search + sorted
  const filteredKnownVaults = useMemo(() => {
    return sortVaults(known_vaults.filter(matchesSearch));
  }, [searchQuery]);

  // All Vaults (Morpho): filtered by search + sorted
  const filteredMorphoVaults = useMemo(() => {
    const uniqueMorphoVaults = morphoWhitelistedVaults.filter((v) => !monarchVaultKeys.has(vaultKey(v)));
    return sortVaults(uniqueMorphoVaults.filter(matchesSearch));
  }, [morphoWhitelistedVaults, monarchVaultKeys, searchQuery]);

  const addVault = (vault: KnownVault) => {
    if (isVaultTrusted(vault)) return;
    const { defaultTrusted: _, ...trustedVault } = vault;
    setUserTrustedVaults([...userTrustedVaults, trustedVault]);
  };

  const removeVault = (vault: TrustedVault | KnownVault) => {
    const targetKey = vaultKey(vault);
    setUserTrustedVaults(userTrustedVaults.filter((v) => vaultKey(v) !== targetKey));
  };

  const toggleVault = (vault: KnownVault) => {
    if (isVaultTrusted(vault)) {
      removeVault(vault);
    } else {
      addVault(vault);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Warning Banner */}
      {!trustedVaultsWarningDismissed && (
        <div className="flex items-start gap-3 rounded bg-yellow-500/10 p-3 text-yellow-700 dark:text-yellow-500">
          <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1 text-xs">
            Vaults are managed by third-party curators. Markets trusted by those vaults are not guaranteed to be risk-free. Always do your
            own research before trusting any vault.
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

      {/* Section 1: MY VAULTS */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">My Vaults</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center justify-between flex-1 text-left"
              onClick={() => setMyVaultsOpen((prev) => !prev)}
            >
              <span className="text-sm font-medium text-primary">Trusted ({userTrustedVaults.length})</span>
              {myVaultsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
          </div>
          {myVaultsOpen &&
            (userTrustedVaults.length === 0 ? (
              <p className="py-2 text-center text-xs text-secondary">No trusted vaults yet. Add vaults from the section below.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sortedTrustedVaults.map((vault) => (
                  <TrustedVaultRow
                    key={`trusted-${vault.address}-${vault.chainId}`}
                    vault={vault}
                    onRemove={() => removeVault(vault)}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Section 2: ADD VAULTS */}
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Add Vaults</h3>

        {/* Search - only filters this section */}
        <Input
          placeholder="Search by name, curator, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          className="w-full font-zen"
        />

        {/* Subsection: Known Vaults (collapsible) */}
        <CollapsibleSection
          title="Known Vaults"
          count={filteredKnownVaults.length}
          isOpen={knownVaultsOpen}
          onToggle={() => setKnownVaultsOpen((prev) => !prev)}
        >
          <p className="text-xs text-secondary">Curated list of verified vaults.</p>
          {filteredKnownVaults.length === 0 ? (
            <p className="py-2 text-center text-xs text-secondary">No known vaults match your search.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredKnownVaults.map((vault) => (
                <AddVaultRow
                  key={`known-${vault.address}-${vault.chainId}`}
                  vault={vault}
                  trusted={isVaultTrusted(vault)}
                  onToggle={() => toggleVault(vault)}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <Divider />

        {/* Subsection: All Vaults (collapsible) */}
        <CollapsibleSection
          title="All Vaults"
          count={filteredMorphoVaults.length}
          isOpen={allVaultsOpen}
          onToggle={() => setAllVaultsOpen((prev) => !prev)}
        >
          <p className="text-xs text-secondary">Additional vaults from the Morpho registry.</p>
          <AllVaultsContent
            isLoading={morphoLoading}
            vaults={filteredMorphoVaults}
            searchQuery={searchQuery}
            isVaultTrusted={isVaultTrusted}
            toggleVault={toggleVault}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
