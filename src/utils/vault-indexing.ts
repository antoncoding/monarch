/**
 * Utility for managing vault indexing state in localStorage.
 * Tracks when a vault is waiting for API indexing after initialization,
 * with automatic cleanup after 2 minutes.
 */

type IndexingVault = {
  address: string;
  chainId: number;
  startTime: number;
};

const INDEXING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (reduced since API responds quickly)

function getStorageKey(address: string, chainId: number): string {
  return `vault-indexing-${chainId}-${address.toLowerCase()}`;
}

/**
 * Mark a vault as actively indexing
 */
export function startVaultIndexing(address: string, chainId: number): void {
  try {
    const key = getStorageKey(address, chainId);
    const data: IndexingVault = {
      address,
      chainId,
      startTime: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to start vault indexing:', error);
  }
}

/**
 * Check if a vault is currently indexing.
 * Returns null if not indexing or if timeout has been reached.
 * Automatically cleans up expired entries.
 */
export function getIndexingVault(address: string, chainId: number): IndexingVault | null {
  try {
    const key = getStorageKey(address, chainId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data = JSON.parse(stored) as IndexingVault;
    const elapsed = Date.now() - data.startTime;

    // Check if timeout reached
    if (elapsed > INDEXING_TIMEOUT_MS) {
      // Auto-cleanup expired entry
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Failed to get vault indexing state:', error);
    return null;
  }
}

/**
 * Stop indexing for a vault (called when data successfully loads)
 */
export function stopVaultIndexing(address: string, chainId: number): void {
  try {
    const key = getStorageKey(address, chainId);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to stop vault indexing:', error);
  }
}
