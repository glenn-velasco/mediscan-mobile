import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

describe('runMigrations', () => {
  it('applies every migration cleanly on a fresh database', async () => {
    const db = createNodeSqliteAdapter();
    await runMigrations(db);

    const versions = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC',
    );
    expect(versions.map((v) => v.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('device_keys');
    expect(tableNames).toContain('pending_sync_envelopes');
    expect(tableNames).toContain('professional_attestations');
    expect(tableNames).toContain('diagnoses');
    expect(tableNames).toContain('medications');
    expect(tableNames).not.toContain('mutation_queue');

    const diagnosisColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(diagnoses)');
    expect(diagnosisColumns.map((c) => c.name)).not.toContain('encrypted_data');
    expect(diagnosisColumns.map((c) => c.name)).toContain('condition');
  });

  it('is idempotent — running twice does not error or duplicate schema_migrations rows', async () => {
    const db = createNodeSqliteAdapter();
    await runMigrations(db);
    await runMigrations(db);

    const versions = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations');
    expect(versions).toHaveLength(19);
  });

  it('accepts Supabase UUIDs in local primary-key tables', async () => {
    const db = createNodeSqliteAdapter();
    await runMigrations(db);
    const userId = '8d52cf98-cc44-4c82-8306-87cd27ba3de1';
    const recordId = 'a9df3cbc-58bb-4fbf-a0bf-bcab8b3a7e13';

    await db.runAsync(
      `INSERT INTO medical_information (user_id, updated_at_local)
       VALUES (?, ?)`,
      userId,
      new Date().toISOString(),
    );
    await db.runAsync(
      `INSERT INTO device_keys (user_id, public_key, updated_at_local)
       VALUES (?, 'public-key', ?)`,
      userId,
      new Date().toISOString(),
    );
    await db.runAsync(
      `INSERT INTO my_scan_activity (id, user_id, scanner_fullname, scanned_at, synced_at)
       VALUES (?, ?, 'Dr. Test', ?, ?)`,
      recordId,
      userId,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    await expect(
      db.getFirstAsync('SELECT user_id FROM medical_information WHERE user_id = ?', userId),
    ).resolves.toMatchObject({ user_id: userId });
  });

  it('rejects duplicate non-null server_envelope_id but allows multiple NULLs (BLE-received envelopes)', async () => {
    const db = createNodeSqliteAdapter();
    await runMigrations(db);

    const insert = (serverEnvelopeId: number | null, localId: string) =>
      db.runAsync(
        `INSERT INTO pending_sync_envelopes (local_id, server_envelope_id, envelope_type, ciphertext, created_at)
         VALUES (?, ?, 'general_note', 'ciphertext', ?)`,
        localId,
        serverEnvelopeId,
        new Date().toISOString(),
      );

    await insert(1, 'a');
    await expect(insert(1, 'b')).rejects.toThrow();

    await insert(null, 'c');
    await insert(null, 'd');
    const rows = await db.getAllAsync('SELECT local_id FROM pending_sync_envelopes WHERE server_envelope_id IS NULL');
    expect(rows).toHaveLength(2);
  });
});
