/**
 * Utility for storing and retrieving deployed vault addresses in localStorage.
 * This ensures newly deployed vaults show up in the vault list immediately,
 * even if the Morpho API hasn't indexed them yet.
 */

type StoredVault = {
  address: string;
  chainId: number;
  timestamp: number;
};

const STORAGE_KEY = 'deployed-vaults';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Add a newly deployed vault to localStorage
 */
export function addDeployedVault(address: string, chainId: number): void {
  try {
    const vaults = getDeployedVaults();

    // Check if vault already exists
    const exists = vaults.some((v) => v.address.toLowerCase() === address.toLowerCase() && v.chainId === chainId);

    if (!exists) {
      vaults.push({
        address,
        chainId,
        timestamp: Date.now(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
    }
  } catch (error) {
    // Silently fail if localStorage is unavailable
    console.warn('Failed to store vault address:', error);
  }
}

/**
 * Get all stored vault addresses, automatically cleaning up old entries
 */
export function getDeployedVaults(): StoredVault[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const vaults = JSON.parse(stored) as StoredVault[];
    const now = Date.now();

    // Filter out old entries (older than 24 hours)
    const filtered = vaults.filter((v) => now - v.timestamp < MAX_AGE_MS);

    // Update storage if we filtered anything out
    if (filtered.length !== vaults.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch (error) {
    console.warn('Failed to retrieve vault addresses:', error);
    return [];
  }
}

/**
 * Manually clean up old vault entries
 */
export function cleanupOldVaults(): void {
  getDeployedVaults(); // Calling this triggers auto-cleanup
}
