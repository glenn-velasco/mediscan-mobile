import type { SQLiteDatabase } from 'expo-sqlite';

import * as migration001 from '@/db/migrations/001_init';
import * as migration002 from '@/db/migrations/002_encrypt_medical_data';
import * as migration003 from '@/db/migrations/003_emergency_contacts';
import * as migration004 from '@/db/migrations/004_remove_legacy_sync_queue';
import * as migration005 from '@/db/migrations/005_device_keys';
import * as migration006 from '@/db/migrations/006_pending_sync_envelopes';
import * as migration007 from '@/db/migrations/007_professional_attestations';
import * as migration008 from '@/db/migrations/008_diagnoses';
import * as migration009 from '@/db/migrations/009_add_user_id';
import * as migration010 from '@/db/migrations/010_medications';
import * as migration011 from '@/db/migrations/011_split_encrypted_fields';
import * as migration012 from '@/db/migrations/012_diagnosis_authorship';
import * as migration013 from '@/db/migrations/013_conditions';
import * as migration014 from '@/db/migrations/014_condition_attestations';
import * as migration015 from '@/db/migrations/015_pending_verification_syncs';
import * as migration016 from '@/db/migrations/016_add_verified_by_to_records';

const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013, migration014, migration015, migration016];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  let ranMigration016 = false;

  for (const migration of migrations) {
    const existing = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      migration.version,
    );
    if (existing) continue;

    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        migration.version,
        new Date().toISOString(),
      );
    });

    if (migration.version === 16) {
      ranMigration016 = true;
    }
  }

  // Backfill verified_by from existing attestations after migration 016.
  // Pass the already-opened db directly — calling getDb() here would deadlock
  // because dbPromise is still pending on this very migration chain.
  if (ranMigration016) {
    try {
      const { backfillVerifiedBy } = await import('@/services/backfill-verified-by.service');
      await backfillVerifiedBy(db);
    } catch (err) {
      console.warn('[Migrations] Backfill verified_by failed (will retry on next sync)', err);
    }
  }
}
