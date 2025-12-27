import storage from 'local-storage-fallback';

/**
 * One-time storage migration system
 *
 * Purpose: Migrate from useLocalStorage to Zustand stores while preserving user data
 *
 * Timeline:
 * - Created: January Dec
 * - Expiry: February 1, 2026
 * - Delete after: February 2026 (1 month grace period)
 *
 * Safety features:
 * - Idempotent (safe to run multiple times)
 * - Validates data before migrating
 * - Logs all actions for debugging
 * - Never deletes old data until migration succeeds
 * - Auto-disables after expiry date
 */

// Migration configuration
export const MIGRATION_STATUS_KEY = 'monarch_migration_v1_complete';
export const MIGRATION_EXPIRY_DATE = '2026-02-01';
export const MIGRATION_VERSION = 'v1';

/**
 * Migration definition for a single localStorage key → Zustand store
 */
export type MigrationDefinition<T = any> = {
  /** Old localStorage key to migrate from */
  oldKey: string;

  /** New Zustand persist key (MUST be different from oldKey!) */
  newKey: string;

  /** Zustand store name (for logging) */
  storeName: string;

  /**
   * Migration function that receives old data and store instance
   * Returns true if migration succeeded, false if skipped
   */
  migrate: (oldData: T) => boolean;

  /**
   * Optional validation function
   * Returns true if data is valid and should be migrated
   */
  validate?: (data: unknown) => data is T;

  /**
   * Optional description for logging
   */
  description?: string;
};

/**
 * Result of a single migration attempt
 */
export type MigrationResult = {
  oldKey: string;
  storeName: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  error?: unknown;
};

/**
 * Check if migrations have already been completed
 */
export function isMigrationComplete(): boolean {
  try {
    const status = storage.getItem(MIGRATION_STATUS_KEY);
    return status === 'true';
  } catch (error) {
    console.warn('Error checking migration status:', error);
    return false;
  }
}

/**
 * Mark migrations as complete
 */
export function markMigrationComplete(): void {
  try {
    storage.setItem(MIGRATION_STATUS_KEY, 'true');
    console.log(`✅ Migration ${MIGRATION_VERSION} marked as complete`);
  } catch (error) {
    console.error('Error marking migration complete:', error);
  }
}

/**
 * Check if migration component has expired
 * If expired, logs warning and suggests removal
 */
export function isMigrationExpired(): boolean {
  const now = new Date();
  const expiry = new Date(MIGRATION_EXPIRY_DATE);

  if (now > expiry) {
    console.warn(
      `⚠️  MIGRATION COMPONENT EXPIRED (${MIGRATION_EXPIRY_DATE})\n` +
        '    Please remove StorageMigrator component from codebase:\n' +
        '    1. Remove <StorageMigrator /> from app/layout.tsx\n' +
        '    2. Delete src/components/StorageMigrator.tsx\n' +
        '    3. Delete src/utils/storage-migration.ts',
    );
    return true;
  }

  return false;
}

/**
 * Execute a single migration
 */
export function executeMigration<T>(definition: MigrationDefinition<T>): MigrationResult {
  const { oldKey, newKey, storeName, migrate, validate, description } = definition;

  try {
    // CRITICAL: Verify old and new keys are different!
    if (oldKey === newKey) {
      return {
        oldKey,
        storeName,
        status: 'error',
        reason: 'CRITICAL: oldKey and newKey must be different to prevent data loss!',
        error: new Error('oldKey === newKey'),
      };
    }

    // Check if old data exists
    const oldDataRaw = storage.getItem(oldKey);

    if (!oldDataRaw) {
      return {
        oldKey,
        storeName,
        status: 'skipped',
        reason: 'No data found in old localStorage key',
      };
    }

    // Check if new key already has data (migration already happened?)
    const newDataRaw = storage.getItem(newKey);
    if (newDataRaw) {
      console.log(`⚠️  New key "${newKey}" already has data - skipping migration`);
      // Don't delete old data yet - maybe user manually migrated
      return {
        oldKey,
        storeName,
        status: 'skipped',
        reason: 'New key already has data (migration already completed?)',
      };
    }

    // Parse old data
    let oldData: unknown;
    try {
      oldData = JSON.parse(oldDataRaw);
    } catch (parseError) {
      return {
        oldKey,
        storeName,
        status: 'error',
        reason: 'Failed to parse JSON from old key',
        error: parseError,
      };
    }

    // Validate if validation function provided
    if (validate && !validate(oldData)) {
      return {
        oldKey,
        storeName,
        status: 'skipped',
        reason: 'Data validation failed',
      };
    }

    // Execute migration (writes to new key via Zustand)
    const success = migrate(oldData as T);

    if (!success) {
      return {
        oldKey,
        storeName,
        status: 'skipped',
        reason: 'Migration function returned false',
      };
    }

    // Verify new data was written
    const verifyNewData = storage.getItem(newKey);
    if (!verifyNewData) {
      return {
        oldKey,
        storeName,
        status: 'error',
        reason: 'Migration function succeeded but new key has no data!',
        error: new Error('New key is empty after migration'),
      };
    }

    // Migration succeeded AND verified - NOW it's safe to remove old data
    storage.removeItem(oldKey);

    return {
      oldKey,
      storeName,
      status: 'success',
      reason: description,
    };
  } catch (error) {
    return {
      oldKey,
      storeName,
      status: 'error',
      reason: 'Unexpected error during migration',
      error,
    };
  }
}

/**
 * Execute all migrations and return results
 */
export function executeAllMigrations(migrations: MigrationDefinition[]): MigrationResult[] {
  console.log(`🚀 Starting storage migration ${MIGRATION_VERSION}...`);
  console.log(`📦 ${migrations.length} migrations to process`);

  const results: MigrationResult[] = [];

  for (const migration of migrations) {
    const result = executeMigration(migration);
    results.push(result);

    // Log result
    const emoji = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️';
    const message = `${emoji} ${migration.oldKey} → ${migration.storeName}`;

    if (result.status === 'success') {
      console.log(message, result.reason ? `(${result.reason})` : '');
    } else if (result.status === 'error') {
      console.error(message, result.reason, result.error);
    } else {
      console.log(message, `(${result.reason})`);
    }
  }

  // Summary
  const successful = results.filter((r) => r.status === 'success').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  console.log(
    `\n📊 Migration ${MIGRATION_VERSION} Summary:\n` +
      `   ✅ Successful: ${successful}\n` +
      `   ⏭️  Skipped: ${skipped}\n` +
      `   ❌ Errors: ${errors}\n`,
  );

  return results;
}
