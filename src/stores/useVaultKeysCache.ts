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

/**
 * Deduplicate and merge multiple lists of addresses (case-insensitive).
 * Returns a new array containing unique addresses from all sources, in order of appearance.
 */
export function combineAddresses(...sources: (string[] | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    for (const addr of source) {
      const lower = addr.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(lower);
      }
    }
  }
  return result;
}

/**
 * Deduplicate and merge multiple lists of caps (by capId).
 * Returns a new array containing unique caps from all sources, in order of appearance.
 */
export function combineCaps(...sources: (CachedCap[] | undefined | null)[]): CachedCap[] {
  const seen = new Set<string>();
  const result: CachedCap[] = [];
  for (const source of sources) {
    if (!source) continue;
    for (const cap of source) {
      if (!seen.has(cap.capId)) {
        seen.add(cap.capId);
        result.push({ capId: cap.capId, idParams: cap.idParams });
      }
    }
  }
  return result;
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
          const merged = combineAddresses(entry.allocators, addresses);
          if (merged.length === entry.allocators.length) return state;
          return { cache: { ...state.cache, [vaultKey]: { ...entry, allocators: merged } } };
        });
      },

      addCaps: (vaultKey, caps) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const merged = combineCaps(entry.caps, caps);
          if (merged.length === entry.caps.length) return state;
          return { cache: { ...state.cache, [vaultKey]: { ...entry, caps: merged } } };
        });
      },

      addAdapters: (vaultKey, addresses) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const merged = combineAddresses(entry.adapters, addresses);
          if (merged.length === entry.adapters.length) return state;
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
      (addresses: string[]) => {
        if (vaultKey) store.addAllocators(vaultKey, addresses);
      },
      [store.addAllocators, vaultKey],
    ),
    addCaps: useCallback(
      (caps: CachedCap[]) => {
        if (vaultKey) store.addCaps(vaultKey, caps);
      },
      [store.addCaps, vaultKey],
    ),
    addAdapters: useCallback(
      (addresses: string[]) => {
        if (vaultKey) store.addAdapters(vaultKey, addresses);
      },
      [store.addAdapters, vaultKey],
    ),
    getVaultKeys: useCallback(
      (): VaultKeysEntry => (vaultKey ? store.getVaultKeys(vaultKey) : emptyEntry()),
      [store.getVaultKeys, vaultKey],
    ),
    seedFromApi: useCallback(
      (entry: Partial<VaultKeysEntry>) => {
        if (vaultKey) store.seedFromApi(vaultKey, entry);
      },
      [store.seedFromApi, vaultKey],
    ),
    vaultKey,
  };
}

export type { CachedCap, VaultKeysEntry };
