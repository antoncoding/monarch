import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CachedAllocator = {
  address: string;
};

type CachedCap = {
  capId: string;
  idParams: string;
};

type CachedAdapter = {
  address: string;
};

type VaultKeysEntry = {
  allocators: CachedAllocator[];
  caps: CachedCap[];
  adapters: CachedAdapter[];
};

type VaultKeysCache = Record<string, VaultKeysEntry>;

type VaultKeysCacheState = {
  cache: VaultKeysCache;
};

type VaultKeysCacheActions = {
  addAllocators: (vaultKey: string, allocators: CachedAllocator[]) => void;
  addCaps: (vaultKey: string, caps: CachedCap[]) => void;
  addAdapters: (vaultKey: string, adapters: CachedAdapter[]) => void;
  getVaultKeys: (vaultKey: string) => VaultKeysEntry;
  seedFromApi: (vaultKey: string, entry: Partial<VaultKeysEntry>) => void;
};

type VaultKeysCacheStore = VaultKeysCacheState & VaultKeysCacheActions;

function emptyEntry(): VaultKeysEntry {
  return { allocators: [], caps: [], adapters: [] };
}

function makeVaultKey(vaultAddress: string, chainId: number): string {
  return `${vaultAddress.toLowerCase()}:${chainId}`;
}

/**
 * Zustand store for caching vault data keys (allocators, caps, adapters).
 *
 * This store persists the "keys" needed to query on-chain vault state via RPC.
 * It bridges the gap between the slow Morpho API indexer and instant on-chain data:
 * - After transactions, push new keys here → next RPC fetch picks them up instantly
 * - API data seeds this cache on first load → ensures keys survive across sessions
 * - RPC verifies each key on-chain → stale keys are filtered out automatically
 */
export const useVaultKeysCacheStore = create<VaultKeysCacheStore>()(
  persist(
    (set, get) => ({
      cache: {},

      addAllocators: (vaultKey, allocators) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const existing = entry.allocators;
          let hasChanges = false;
          const updated = [...existing];

          for (const alloc of allocators) {
            const addr = alloc.address.toLowerCase();
            const exists = updated.some((a) => a.address.toLowerCase() === addr);
            if (!exists) {
              updated.push({ address: addr });
              hasChanges = true;
            }
          }

          if (!hasChanges) return state;

          return {
            cache: {
              ...state.cache,
              [vaultKey]: { ...entry, allocators: updated },
            },
          };
        });
      },

      addCaps: (vaultKey, caps) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const existing = entry.caps;
          let hasChanges = false;
          const updated = [...existing];

          for (const cap of caps) {
            const exists = updated.some((c) => c.capId === cap.capId);
            if (!exists) {
              updated.push({ capId: cap.capId, idParams: cap.idParams });
              hasChanges = true;
            }
          }

          if (!hasChanges) return state;

          return {
            cache: {
              ...state.cache,
              [vaultKey]: { ...entry, caps: updated },
            },
          };
        });
      },

      addAdapters: (vaultKey, adapters) => {
        set((state) => {
          const entry = state.cache[vaultKey] ?? emptyEntry();
          const existing = entry.adapters;
          let hasChanges = false;
          const updated = [...existing];

          for (const adapter of adapters) {
            const addr = adapter.address.toLowerCase();
            const exists = updated.some((a) => a.address.toLowerCase() === addr);
            if (!exists) {
              updated.push({ address: addr });
              hasChanges = true;
            }
          }

          if (!hasChanges) return state;

          return {
            cache: {
              ...state.cache,
              [vaultKey]: { ...entry, adapters: updated },
            },
          };
        });
      },

      getVaultKeys: (vaultKey) => {
        return get().cache[vaultKey] ?? emptyEntry();
      },

      seedFromApi: (vaultKey, entry) => {
        const store = get();
        if (entry.allocators?.length) {
          store.addAllocators(vaultKey, entry.allocators);
        }
        if (entry.caps?.length) {
          store.addCaps(vaultKey, entry.caps);
        }
        if (entry.adapters?.length) {
          store.addAdapters(vaultKey, entry.adapters);
        }
      },
    }),
    {
      name: 'monarch_store_vaultKeysCache',
    },
  ),
);

/**
 * Convenience hook with scoped API for a specific vault.
 *
 * @example
 * ```tsx
 * const { addAllocators, addCaps, getVaultKeys } = useVaultKeysCache(vaultAddress, chainId);
 * ```
 */
export function useVaultKeysCache(vaultAddress: string | undefined, chainId: number | undefined) {
  const vaultKey = vaultAddress && chainId ? makeVaultKey(vaultAddress, chainId) : '';

  const storeAddAllocators = useVaultKeysCacheStore((s) => s.addAllocators);
  const storeAddCaps = useVaultKeysCacheStore((s) => s.addCaps);
  const storeAddAdapters = useVaultKeysCacheStore((s) => s.addAdapters);
  const storeGetVaultKeys = useVaultKeysCacheStore((s) => s.getVaultKeys);
  const storeSeedFromApi = useVaultKeysCacheStore((s) => s.seedFromApi);

  return {
    addAllocators: useCallback(
      (allocators: CachedAllocator[]) => {
        if (!vaultKey) return;
        storeAddAllocators(vaultKey, allocators);
      },
      [storeAddAllocators, vaultKey],
    ),

    addCaps: useCallback(
      (caps: CachedCap[]) => {
        if (!vaultKey) return;
        storeAddCaps(vaultKey, caps);
      },
      [storeAddCaps, vaultKey],
    ),

    addAdapters: useCallback(
      (adapters: CachedAdapter[]) => {
        if (!vaultKey) return;
        storeAddAdapters(vaultKey, adapters);
      },
      [storeAddAdapters, vaultKey],
    ),

    getVaultKeys: useCallback((): VaultKeysEntry => {
      if (!vaultKey) return emptyEntry();
      return storeGetVaultKeys(vaultKey);
    }, [storeGetVaultKeys, vaultKey]),

    seedFromApi: useCallback(
      (entry: Partial<VaultKeysEntry>) => {
        if (!vaultKey) return;
        storeSeedFromApi(vaultKey, entry);
      },
      [storeSeedFromApi, vaultKey],
    ),

    vaultKey,
  };
}

export type { CachedAllocator, CachedCap, CachedAdapter, VaultKeysEntry };
