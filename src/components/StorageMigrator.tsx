'use client';

import { useEffect } from 'react';
import storage from 'local-storage-fallback';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { useHistoryPreferences } from '@/stores/useHistoryPreferences';
import { usePositionsPreferences } from '@/stores/usePositionsPreferences';
import { SortColumn } from '@/features/markets/components/constants';
import { DEFAULT_MIN_SUPPLY_USD } from '@/constants/markets';
import { DEFAULT_COLUMN_VISIBILITY } from '@/features/markets/components/column-visibility';
import {
  type MigrationDefinition,
  isMigrationComplete,
  isMigrationExpired,
  markMigrationComplete,
  executeAllMigrations,
} from '@/utils/storage-migration';

/**
 * One-Time Storage Migrator Component
 *
 * **Purpose:** Migrate user data from old useLocalStorage format to new Zustand stores
 *
 * **Timeline:**
 * - Created: January 2025
 * - Expires: February 1, 2025
 * - DELETE THIS FILE AFTER: February 2025
 *
 * **How it works:**
 * 1. Runs once on app load
 * 2. Checks if migrations already completed (via localStorage flag)
 * 3. Executes all defined migrations
 * 4. Logs progress to console
 * 5. Marks as complete
 * 6. Auto-disables after expiry date
 *
 * **To delete (after Feb 2025):**
 * 1. Remove `<StorageMigrator />` from `app/layout.tsx`
 * 2. Delete this file: `src/components/StorageMigrator.tsx`
 * 3. Delete `src/utils/storage-migration.ts`
 * 4. Remove any stores that were only created for migration
 *
 * @returns null - This component renders nothing
 */

/**
 * Helper: Safely parse JSON from localStorage
 */
function _safeParseJSON<T>(value: string | null, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Helper: Get localStorage value or default
 */
function getStorageValue<T>(key: string, defaultValue: T): T {
  const value = storage.getItem(key);
  if (value === null) return defaultValue;

  // If default is a boolean/number, parse accordingly
  if (typeof defaultValue === 'boolean') {
    return (value === 'true') as T;
  }
  if (typeof defaultValue === 'number') {
    const parsed = Number(value);
    return (Number.isNaN(parsed) ? defaultValue : parsed) as T;
  }

  // Try JSON parse
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export function StorageMigrator() {
  useEffect(() => {
    // Skip if already completed
    if (isMigrationComplete()) {
      console.log('✅ Storage migrations already completed - skipping');
      return;
    }

    // Skip if expired (with warning)
    if (isMigrationExpired()) {
      return;
    }

    // Define all migrations
    const migrations: MigrationDefinition[] = [
      // ========================================
      // Migration 1: Trusted Vaults
      // ========================================
      {
        oldKey: 'userTrustedVaults',
        newKey: 'monarch_store_trustedVaults',
        storeName: 'useTrustedVaults',
        description: 'Migrated Trusted Vaults to Zustand store',
        validate: (data): data is TrustedVault[] => {
          if (!Array.isArray(data)) return false;
          return data.every(
            (item) =>
              item &&
              typeof item === 'object' &&
              'address' in item &&
              'chainId' in item &&
              typeof item.address === 'string' &&
              typeof item.chainId === 'number',
          );
        },
        migrate: (oldData: TrustedVault[]) => {
          try {
            const store = useTrustedVaults.getState();
            store.setVaults(oldData);
            return true;
          } catch (error) {
            console.error('Error migrating trusted vaults:', error);
            return false;
          }
        },
      },

      // ========================================
      // Migration 2: Market Preferences (MULTI-KEY)
      // ========================================
      {
        oldKey: 'monarch_marketsSortColumn', // Primary key to check
        newKey: 'monarch_store_marketPreferences',
        storeName: 'useMarketPreferences',
        description: 'Migrated Market Preferences to Zustand store (15 keys)',
        // No validate function - we handle all keys ourselves
        migrate: () => {
          try {
            // Read all old market preference keys
            const sortColumn = getStorageValue('monarch_marketsSortColumn', SortColumn.Supply);
            const sortDirection = getStorageValue('monarch_marketsSortDirection', -1);
            const entriesPerPage = getStorageValue('monarch_marketsEntriesPerPage', 8);
            const includeUnknownTokens = getStorageValue('includeUnknownTokens', false);
            const showUnknownOracle = getStorageValue('showUnknownOracle', false);
            const trustedVaultsOnly = getStorageValue('monarch_marketsTrustedVaultsOnly', false);
            const columnVisibility = getStorageValue('monarch_marketsColumnVisibility', DEFAULT_COLUMN_VISIBILITY);
            const tableViewMode = getStorageValue('monarch_marketsTableViewMode', 'compact');
            const usdMinSupply = getStorageValue('monarch_marketsUsdMinSupply_2', DEFAULT_MIN_SUPPLY_USD.toString());
            const usdMinBorrow = getStorageValue('monarch_marketsUsdMinBorrow', '');
            const usdMinLiquidity = getStorageValue('monarch_marketsUsdMinLiquidity', '');
            const minSupplyEnabled = getStorageValue('monarch_minSupplyEnabled', false);
            const minBorrowEnabled = getStorageValue('monarch_minBorrowEnabled', false);
            const minLiquidityEnabled = getStorageValue('monarch_minLiquidityEnabled', false);
            const starredMarkets = getStorageValue('monarch_marketsFavorites', []);

            // Write to store
            const store = useMarketPreferences.getState();
            store.setAll({
              sortColumn,
              sortDirection,
              entriesPerPage,
              includeUnknownTokens,
              showUnknownOracle,
              trustedVaultsOnly,
              columnVisibility,
              tableViewMode,
              usdMinSupply,
              usdMinBorrow,
              usdMinLiquidity,
              minSupplyEnabled,
              minBorrowEnabled,
              minLiquidityEnabled,
              starredMarkets,
            });

            return true;
          } catch (error) {
            console.error('Error migrating market preferences:', error);
            return false;
          }
        },
      },

      // ========================================
      // Migration 3: App Settings (MULTI-KEY)
      // ========================================
      {
        oldKey: 'usePermit2', // Primary key to check
        newKey: 'monarch_store_appSettings',
        storeName: 'useAppSettings',
        description: 'Migrated App Settings to Zustand store (5 keys)',
        // No validate function - we handle all keys ourselves
        migrate: () => {
          try {
            // Read all old app setting keys
            const usePermit2 = getStorageValue('usePermit2', true);
            const useEth = getStorageValue('useEth', false);
            const showUnwhitelistedMarkets = getStorageValue('showUnwhitelistedMarkets', false);
            const showFullRewardAPY = getStorageValue('showFullRewardAPY', false);
            const isAprDisplay = getStorageValue('settings-apr-display', false);

            // Write to store
            const store = useAppSettings.getState();
            store.setAll({
              usePermit2,
              useEth,
              showUnwhitelistedMarkets,
              showFullRewardAPY,
              isAprDisplay,
            });

            return true;
          } catch (error) {
            console.error('Error migrating app settings:', error);
            return false;
          }
        },
      },

      // ========================================
      // Migration 4: History Preferences (MULTI-KEY)
      // ========================================
      {
        oldKey: 'monarch_historyEntriesPerPage', // Primary key to check
        newKey: 'monarch_store_historyPreferences',
        storeName: 'useHistoryPreferences',
        description: 'Migrated History Preferences to Zustand store (2 keys)',
        // No validate function - we handle all keys ourselves
        migrate: () => {
          try {
            // Read all old history preference keys
            const entriesPerPage = getStorageValue('monarch_historyEntriesPerPage', 10);
            const isGroupedView = getStorageValue('monarch_historyGroupedView', true);

            // Write to store
            const store = useHistoryPreferences.getState();
            store.setAll({
              entriesPerPage,
              isGroupedView,
            });

            return true;
          } catch (error) {
            console.error('Error migrating history preferences:', error);
            return false;
          }
        },
      },

      // ========================================
      // Migration 5: Positions Preferences
      // ========================================
      {
        oldKey: 'positions:show-collateral-exposure',
        newKey: 'monarch_store_positionsPreferences',
        storeName: 'usePositionsPreferences',
        description: 'Migrated Positions Preferences to Zustand store',
        // No validate function - we handle it ourselves
        migrate: () => {
          try {
            const showCollateralExposure = getStorageValue('positions:show-collateral-exposure', true);

            const store = usePositionsPreferences.getState();
            store.setShowCollateralExposure(showCollateralExposure);

            return true;
          } catch (error) {
            console.error('Error migrating positions preferences:', error);
            return false;
          }
        },
      },
    ];

    // Execute all migrations
    const results = executeAllMigrations(migrations);

    // Clean up ALL old localStorage keys after migrations
    // (executeMigration only deletes the primary oldKey, not related keys)
    const anySuccess = results.some((r) => r.status === 'success');
    if (anySuccess || results.every((r) => r.status === 'skipped')) {
      console.log('🧹 Cleaning up old localStorage keys...');

      // Market Preferences keys
      const marketKeys = [
        'monarch_marketsSortDirection',
        'monarch_marketsEntriesPerPage',
        'includeUnknownTokens',
        'showUnknownOracle',
        'monarch_marketsTrustedVaultsOnly',
        'monarch_marketsColumnVisibility',
        'monarch_marketsTableViewMode',
        'monarch_marketsUsdMinSupply_2',
        'monarch_marketsUsdMinBorrow',
        'monarch_marketsUsdMinLiquidity',
        'monarch_minSupplyEnabled',
        'monarch_minBorrowEnabled',
        'monarch_minLiquidityEnabled',
        'monarch_marketsFavorites',
      ];

      // App Settings keys
      const appKeys = ['useEth', 'showUnwhitelistedMarkets', 'showFullRewardAPY', 'settings-apr-display'];

      // History Preferences keys
      const historyKeys = ['monarch_historyGroupedView'];

      // Delete all secondary keys (primary keys already deleted by executeMigration)
      [...marketKeys, ...appKeys, ...historyKeys].forEach((key) => {
        storage.removeItem(key);
      });

      console.log('✅ Cleanup complete');
      markMigrationComplete();
    }
  }, []); // Run once on mount

  // Render nothing
  return null;
}
