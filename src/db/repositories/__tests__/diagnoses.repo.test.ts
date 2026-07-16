import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `test-uuid-${++counter}`),
  };
});

beforeEach(async () => {
  const db = createNodeSqliteAdapter();
  await runMigrations(db);
  (getDb as jest.Mock).mockResolvedValue(db);
  setCurrentUserId(0);
});

describe('diagnoses.repo', () => {
  it('round-trips a created diagnosis (payload encrypted at rest, decrypted on read)', async () => {
    const localUuid = await diagnosesRepo.createLocal({
      condition: 'Type 2 diabetes',
      date_of_diagnosis: '2024-03-15',
      severity: 'chronic',
    });

    const all = await diagnosesRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      local_uuid: localUuid,
      condition: 'Type 2 diabetes',
      date_of_diagnosis: '2024-03-15',
      severity: 'chronic',
      sync_status: 'synced',
      deleted_locally: 0,
    });

    const db = await getDb();
    const raw = await db.getFirstAsync<{ encrypted_data: string }>(
      'SELECT encrypted_data FROM diagnoses WHERE local_uuid = ?',
      localUuid,
    );
    expect(raw!.encrypted_data).not.toContain('diabetes');
  });

  it('getAll excludes soft-deleted diagnoses', async () => {
    const uuid = await diagnosesRepo.createLocal({ condition: 'Hypertension', severity: 'ongoing' });
    // server_id is null on a fresh local create, so deleteLocal hard-deletes immediately
    await diagnosesRepo.deleteLocal(uuid);

    expect(await diagnosesRepo.getAll()).toHaveLength(0);
  });

  it('getByLocalUuid returns null for an unknown uuid', async () => {
    expect(await diagnosesRepo.getByLocalUuid('does-not-exist')).toBeNull();
  });

  it('updateLocal merges partial fields without losing unchanged ones', async () => {
    const uuid = await diagnosesRepo.createLocal({
      condition: 'Asthma',
      date_of_diagnosis: '2023-01-01',
      severity: 'ongoing',
    });

    await diagnosesRepo.updateLocal(uuid, { severity: 'acute' });

    const updated = await diagnosesRepo.getByLocalUuid(uuid);
    expect(updated).toMatchObject({
      condition: 'Asthma',
      date_of_diagnosis: '2023-01-01',
      severity: 'acute',
    });
  });

  it('toPayload maps a row to the API payload shape', () => {
    expect(
      diagnosesRepo.toPayload({
        local_uuid: 'x',
        user_id: 1,
        server_id: null,
        sync_status: 'synced',
        deleted_locally: 0,
        updated_at_local: 'now',
        condition: 'Flu',
        date_of_diagnosis: '2026-01-01',
        severity: 'acute',
      }),
    ).toEqual({ condition: 'Flu', date_of_diagnosis: '2026-01-01', severity: 'acute' });
  });

  it('markConflict flips sync_status to conflict', async () => {
    const uuid = await diagnosesRepo.createLocal({ condition: 'Migraine', severity: 'chronic' });
    await diagnosesRepo.markConflict(uuid);
    const row = await diagnosesRepo.getByLocalUuid(uuid);
    expect(row!.sync_status).toBe('conflict');
  });
});
