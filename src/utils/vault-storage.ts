/**
 * Utility for storing and retrieving deployed vault addresses in localStorage.
 * This ensures newly deployed vaults show up in the vault list immediately,
 * even if the Morpho API hasn't indexed them yet.
 *
 * Vaults are stored per owner address to prevent cross-user contamination.
 */

type StoredVault = {
  address: string;
  chainId: number;
  ownerAddress: string;
  timestamp: number;
};

const STORAGE_KEY = 'deployed-vaults';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Add a newly deployed vault to localStorage with owner tracking
 */
export function addDeployedVault(address: string, chainId: number, ownerAddress: string): void {
  try {
    const vaults = getAllDeployedVaults();

    // Check if vault already exists for this owner
    const exists = vaults.some(
      (v) =>
        v.address.toLowerCase() === address.toLowerCase() &&
        v.chainId === chainId &&
        v.ownerAddress.toLowerCase() === ownerAddress.toLowerCase(),
    );

    if (!exists) {
      vaults.push({
        address,
        chainId,
        ownerAddress: ownerAddress.toLowerCase(),
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
 * Get all stored vault addresses for a specific owner, automatically cleaning up old entries
 */
export function getDeployedVaults(ownerAddress?: string): StoredVault[] {
  try {
    const vaults = getAllDeployedVaults();

    // If no owner specified, return empty array (don't leak vaults across users)
    if (!ownerAddress) return [];

    // Filter by owner and return
    return vaults.filter((v) => v.ownerAddress.toLowerCase() === ownerAddress.toLowerCase());
  } catch (error) {
    console.warn('Failed to retrieve vault addresses:', error);
    return [];
  }
}

/**
 * Internal: Get all stored vaults (all owners), with automatic cleanup of old entries
 */
function getAllDeployedVaults(): StoredVault[] {
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
