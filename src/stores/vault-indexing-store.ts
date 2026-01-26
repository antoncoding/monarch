import { create } from 'zustand';
import type { Address } from 'viem';

export const INDEXING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

type IndexingVault = {
  address: Address;
  chainId: number;
  startTime: number;
};

type VaultIndexingState = {
  indexingVault: IndexingVault | null;
};

type VaultIndexingActions = {
  startIndexing: (address: Address, chainId: number) => void;
  stopIndexing: () => void;
};

type VaultIndexingStore = VaultIndexingState & VaultIndexingActions;

/**
 * Zustand store for vault indexing state after initialization.
 * Replaces the old localStorage-based system with instant reactivity.
 *
 * After completeInitialization() succeeds, call startIndexing() to signal
 * that the vault page should poll the API until post-initialization data arrives.
 */
export const useVaultIndexingStore = create<VaultIndexingStore>((set) => ({
  indexingVault: null,

  startIndexing: (address, chainId) => {
    set({
      indexingVault: {
        address,
        chainId,
        startTime: Date.now(),
      },
    });
  },

  stopIndexing: () => {
    set({ indexingVault: null });
  },
}));
