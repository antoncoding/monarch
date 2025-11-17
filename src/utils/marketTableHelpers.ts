import { getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { formatBalance, formatReadable } from '@/utils/balance';
import { Market } from '@/utils/types';

const ZERO_DISPLAY_THRESHOLD = 1e-6;

/**
 * Format amount for display in table cells
 * Returns '-' for zero or very small values
 */
export function formatAmountDisplay(value: bigint | string, decimals: number): string {
  const numericValue = formatBalance(value, decimals);
  if (!Number.isFinite(numericValue) || Math.abs(numericValue) < ZERO_DISPLAY_THRESHOLD) {
    return '-';
  }
  return formatReadable(numericValue);
}

/**
 * Get trusted vaults for a market
 * Filters and sorts vaults by curator status and name
 */
export function getTrustedVaultsForMarket(
  market: Market,
  trustedVaultMap: Map<string, TrustedVault>,
): TrustedVault[] {
  if (!market.supplyingVaults?.length) {
    return [];
  }

  const chainId = market.morphoBlue.chain.id;
  const seen = new Set<string>();
  const matches: TrustedVault[] = [];

  market.supplyingVaults.forEach((vault) => {
    if (!vault.address) return;
    const key = getVaultKey(vault.address, chainId);
    if (seen.has(key)) return;
    seen.add(key);
    const trusted = trustedVaultMap.get(key);
    if (trusted) {
      matches.push(trusted);
    }
  });

  return matches.sort((a, b) => {
    const aUnknown = a.curator === 'unknown';
    const bUnknown = b.curator === 'unknown';
    if (aUnknown !== bUnknown) {
      return aUnknown ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Check if market has at least one trusted vault
 */
export function hasTrustedVault(
  market: Market,
  trustedVaultMap: Map<string, TrustedVault>,
): boolean {
  if (!market.supplyingVaults?.length) return false;
  const chainId = market.morphoBlue.chain.id;
  return market.supplyingVaults.some((vault) => {
    if (!vault.address) return false;
    return trustedVaultMap.has(getVaultKey(vault.address as string, chainId));
  });
}

/**
 * Calculate pagination values with safety guards
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number,
  itemsPerPage: number,
) {
  const safePerPage = Math.max(1, Math.floor(itemsPerPage));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * safePerPage;
  const endIndex = startIndex + safePerPage;

  return {
    safePerPage,
    totalPages,
    safePage,
    startIndex,
    endIndex,
  };
}

/**
 * Calculate number of columns for empty state
 */
export function calculateEmptyStateColumns(
  showSelectColumn: boolean,
  columnVisibility: { trustedBy?: boolean },
): number {
  return (showSelectColumn ? 7 : 6) + (columnVisibility.trustedBy ? 1 : 0);
}
