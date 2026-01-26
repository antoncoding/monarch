import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CachedCap = {
  capId: string;
  idParams: string;
};

type VaultKeysEntry = {
  allocators: string[];
  caps: CachedCap[];
  adapters: string[];
};

function emptyEntry(): VaultKeysEntry {
  return { allocators: [], caps: [], adapters: [] };
}

function makeVaultKey(vaultAddress: string, chainId: number): string {
  return `${vaultAddress.toLowerCase()}:${chainId}`;
}

/** Deduplicate and merge new addresses into an existing list (case-insensitive). */
function mergeAddresses(existing: string[], incoming: string[]): string[] | null {
  const seen = new Set(existing.map((a) => a.toLowerCase()));
  let changed = false;
  const result = [...existing];
  for (const addr of incoming) {
    const lower = addr.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
      changed = true;
    }
  }
  return changed ? result : null;
}

/** Deduplicate and merge new caps into an existing list (by capId). */
function mergeCaps(existing: CachedCap[], incoming: CachedCap[]): CachedCap[] | null {
  const seen = new Set(existing.map((c) => c.capId));
  let changed = false;
  const result = [...existing];
  for (const cap of incoming) {
    if (!seen.has(cap.capId)) {
      seen.add(cap.capId);
      result.push({ capId: cap.capId, idParams: cap.idParams });
      changed = true;
    }
  }
  return changed ? result : null;
}

/**
 * Zustand store for caching vault data keys (allocators, caps, adapters).
 *
 * Persists the "keys" needed to query on-chain vault state via RPC.
 * After transactions, push new keys here → next RPC fetch picks them up instantly.
 * API data seeds this cache on first load → keys survive across sessions.
 * RPC verifies each key on-chain → stale keys are filtered out automatically.
 */
export const useVaultKeysCacheStore = create<{
  cache: Record<string, VaultKeysEntry>;
  addAllocators: (vaultKey: string, addresses: string[]) => void;
  addCaps: (vaultKey: string, caps: CachedCap[]) => void;
  addAdapters: (vaultKey: string, addresses: string[]) => void;
  getVaultKeys: (vaultKey: string) => VaultKeysEntry;
  seedFromApi: (vaultKey: string, entry: Partial<VaultKeysEntry>) => void;
}>()(
  persist(
    (set, get) => ({
      cache: {},

      addAllocators: (vaultKey, addresses) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const merged = mergeAddresses(entry.allocators, addresses);
          if (!merged) return state;
          return { cache: { ...state.cache, [vaultKey]: { ...entry, allocators: merged } } };
        });
      },

      addCaps: (vaultKey, caps) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const merged = mergeCaps(entry.caps, caps);
          if (!merged) return state;
          return { cache: { ...state.cache, [vaultKey]: { ...entry, caps: merged } } };
        });
      },

      addAdapters: (vaultKey, addresses) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const merged = mergeAddresses(entry.adapters, addresses);
          if (!merged) return state;
          return { cache: { ...state.cache, [vaultKey]: { ...entry, adapters: merged } } };
        });
      },

      getVaultKeys: (vaultKey) => get().cache[vaultKey] ?? emptyEntry(),

      seedFromApi: (vaultKey, entry) => {
        const store = get();
        if (entry.allocators?.length) store.addAllocators(vaultKey, entry.allocators);
        if (entry.caps?.length) store.addCaps(vaultKey, entry.caps);
        if (entry.adapters?.length) store.addAdapters(vaultKey, entry.adapters);
      },
    }),
    {
      name: 'monarch_store_vaultKeysCache',
      version: 2,
      migrate: () => ({ cache: {} }),
    },
  ),
);

/**
 * Convenience hook scoped to a specific vault.
 *
 * @example
 * const { addAllocators, addCaps, getVaultKeys } = useVaultKeysCache(vaultAddress, chainId);
 */
export function useVaultKeysCache(vaultAddress: string | undefined, chainId: number | undefined) {
  const vaultKey = vaultAddress && chainId ? makeVaultKey(vaultAddress, chainId) : '';
  const store = useVaultKeysCacheStore();

  return {
    addAllocators: useCallback(
      (addresses: string[]) => { if (vaultKey) store.addAllocators(vaultKey, addresses); },
      [store.addAllocators, vaultKey],
    ),
    addCaps: useCallback(
      (caps: CachedCap[]) => { if (vaultKey) store.addCaps(vaultKey, caps); },
      [store.addCaps, vaultKey],
    ),
    addAdapters: useCallback(
      (addresses: string[]) => { if (vaultKey) store.addAdapters(vaultKey, addresses); },
      [store.addAdapters, vaultKey],
    ),
    getVaultKeys: useCallback(
      (): VaultKeysEntry => vaultKey ? store.getVaultKeys(vaultKey) : emptyEntry(),
      [store.getVaultKeys, vaultKey],
    ),
    seedFromApi: useCallback(
      (entry: Partial<VaultKeysEntry>) => { if (vaultKey) store.seedFromApi(vaultKey, entry); },
      [store.seedFromApi, vaultKey],
    ),
    vaultKey,
  };
}

export type { CachedCap, VaultKeysEntry };
