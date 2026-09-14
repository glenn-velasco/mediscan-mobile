import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import type { MedicationPayload } from '@/api/types';

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

const basePayload: MedicationPayload = {
  name: 'Aspirin',
  dosage: '100mg',
  frequency: 'Once daily',
  notes: 'Take with food',
};

describe('medications.repo', () => {
  it('round-trips a created medication (encrypted at rest, decrypted on read)', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row).toMatchObject({
      local_uuid: localUuid,
      name: 'Aspirin',
      dosage: '100mg',
      frequency: 'Once daily',
      notes: 'Take with food',
      sync_status: 'synced',
      deleted_locally: 0,
    });

    const db = await getDb();
    const raw = await db.getFirstAsync<{ name: string }>(
      'SELECT name FROM medications WHERE local_uuid = ?',
      localUuid,
    );
    expect(raw!.name).not.toContain('Aspirin');
  });

  it('getAll excludes soft-deleted rows and orders by updated_at_local DESC', async () => {
    const older = await medicationsRepo.createLocal({ ...basePayload, name: 'Older' });
    await medicationsRepo.markSyncedCreate(older, 1);
    await medicationsRepo.deleteLocal(older); // has server_id -> soft delete

    const newer = await medicationsRepo.createLocal({ ...basePayload, name: 'Newer' });

    const rows = await medicationsRepo.getAll();
    expect(rows.map((r) => r.local_uuid)).toEqual([newer]);
  });

  it('updateLocal patches only the provided fields, preserving the rest', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    await medicationsRepo.updateLocal(localUuid, { dosage: '200mg' });

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row).toMatchObject({
      name: 'Aspirin',
      dosage: '200mg',
      frequency: 'Once daily',
      notes: 'Take with food',
    });
  });

  it('updateLocal on a non-existent uuid is a no-op', async () => {
    await expect(medicationsRepo.updateLocal('missing-uuid', { dosage: '200mg' })).resolves.toBeUndefined();
  });

  it('deleteLocal hard-deletes an unsynced medication (no server_id)', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    const result = await medicationsRepo.deleteLocal(localUuid);

    expect(result).toEqual({ requiresNetworkDelete: false });
    expect(await medicationsRepo.getByLocalUuid(localUuid)).toBeNull();
  });

  it('deleteLocal soft-deletes a synced medication (has server_id)', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);
    await medicationsRepo.markSyncedCreate(localUuid, 42);

    const result = await medicationsRepo.deleteLocal(localUuid);

    expect(result).toEqual({ requiresNetworkDelete: true });
    const db = await getDb();
    const raw = await db.getFirstAsync<{ deleted_locally: number; sync_status: string }>(
      'SELECT deleted_locally, sync_status FROM medications WHERE local_uuid = ?',
      localUuid,
    );
    expect(raw).toMatchObject({ deleted_locally: 1, sync_status: 'pending' });
  });

  it('discardConflict hard-deletes an unsynced record', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    await medicationsRepo.discardConflict(localUuid);

    expect(await medicationsRepo.getByLocalUuid(localUuid)).toBeNull();
  });

  it('discardConflict reverts a synced record back to synced/not-deleted', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);
    await medicationsRepo.markSyncedCreate(localUuid, 42);
    await medicationsRepo.markConflict(localUuid);

    await medicationsRepo.discardConflict(localUuid);

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row).toMatchObject({ sync_status: 'synced', deleted_locally: 0 });
  });

  it('markSyncedCreate sets server_id and sync_status', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    await medicationsRepo.markSyncedCreate(localUuid, 7);

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row).toMatchObject({ server_id: 7, sync_status: 'synced' });
  });

  it('markSynced sets sync_status to synced', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);
    await medicationsRepo.markConflict(localUuid);

    await medicationsRepo.markSynced(localUuid);

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row?.sync_status).toBe('synced');
  });

  it('pushes only new or pending rows and stops after a successful update', async () => {
    const id = await medicationsRepo.createLocal(basePayload);
    expect((await medicationsRepo.getAllForPush()).map((row) => row.local_uuid)).toEqual([id]);
    await medicationsRepo.markSyncedCreate(id, 1);
    expect(await medicationsRepo.getAllForPush()).toEqual([]);
    await medicationsRepo.updateLocal(id, { dosage: '200mg' });
    const [pending] = await medicationsRepo.getAllForPush();
    expect(pending.sync_status).toBe('pending');
    await medicationsRepo.markSynced(id, pending.updated_at_local);
    expect(await medicationsRepo.getAllForPush()).toEqual([]);
  });

  it('keeps a newer local edit pending when an older upload completes', async () => {
    const id = await medicationsRepo.createLocal(basePayload);
    await medicationsRepo.markSyncedCreate(id, 1);
    await medicationsRepo.updateLocal(id, { dosage: '200mg' });
    const older = (await medicationsRepo.getByLocalUuid(id))!;
    await medicationsRepo.updateLocal(id, { dosage: '300mg' });
    const db = await getDb();
    await db.runAsync('UPDATE medications SET updated_at_local = ? WHERE local_uuid = ?', '2026-09-15T00:00:00.000Z', id);
    await medicationsRepo.markSynced(id, older.updated_at_local);
    expect((await medicationsRepo.getByLocalUuid(id))?.sync_status).toBe('pending');
  });

  it('markConflict sets sync_status to conflict', async () => {
    const localUuid = await medicationsRepo.createLocal(basePayload);

    await medicationsRepo.markConflict(localUuid);

    const row = await medicationsRepo.getByLocalUuid(localUuid);
    expect(row?.sync_status).toBe('conflict');
  });

  it('toPayload maps a row back to a MedicationPayload, converting null notes to undefined', async () => {
    const localUuid = await medicationsRepo.createLocal({ ...basePayload, notes: undefined });
    const row = await medicationsRepo.getByLocalUuid(localUuid);

    expect(medicationsRepo.toPayload(row!)).toEqual({
      name: 'Aspirin',
      dosage: '100mg',
      frequency: 'Once daily',
      notes: undefined,
      verified_by: null,
    });
  });
});
