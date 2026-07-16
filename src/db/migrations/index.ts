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

const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

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
  }
}
