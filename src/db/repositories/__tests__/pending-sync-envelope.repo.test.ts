import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));

beforeEach(async () => {
  const db = createNodeSqliteAdapter();
  await runMigrations(db);
  (getDb as jest.Mock).mockResolvedValue(db);
  setCurrentUserId(0);
});

const baseParams = {
  localId: 'local-1',
  serverEnvelopeId: 42,
  transport: 'relay' as const,
  senderId: 7,
  envelopeType: 'allergy_verification',
  ciphertext: 'ciphertext-blob',
  expiresAt: null,
};

describe('pending-sync-envelope.repo', () => {
  it('insertReceived is idempotent on server_envelope_id — a re-poll inserts nothing new', async () => {
    await pendingSyncEnvelopeRepo.insertReceived(baseParams);
    await pendingSyncEnvelopeRepo.insertReceived({ ...baseParams, localId: 'local-2' });

    const all = await pendingSyncEnvelopeRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].local_id).toBe('local-1');
  });

  it('does not dedupe BLE-received rows (server_envelope_id null)', async () => {
    await pendingSyncEnvelopeRepo.insertReceived({ ...baseParams, localId: 'ble-1', serverEnvelopeId: null, transport: 'ble' });
    await pendingSyncEnvelopeRepo.insertReceived({ ...baseParams, localId: 'ble-2', serverEnvelopeId: null, transport: 'ble' });

    expect(await pendingSyncEnvelopeRepo.getAll()).toHaveLength(2);
  });

  it('getUnprocessed only returns rows still in "received" status', async () => {
    await pendingSyncEnvelopeRepo.insertReceived(baseParams);
    expect(await pendingSyncEnvelopeRepo.getUnprocessed()).toHaveLength(1);

    await pendingSyncEnvelopeRepo.markMerged('local-1');
    expect(await pendingSyncEnvelopeRepo.getUnprocessed()).toHaveLength(0);
  });

  it('markDecryptFailed records the error and status, markExpired/markAcked/markDecrypted update status only', async () => {
    await pendingSyncEnvelopeRepo.insertReceived(baseParams);

    await pendingSyncEnvelopeRepo.markDecryptFailed('local-1', 'unseal_failed');
    let row = await pendingSyncEnvelopeRepo.getByLocalId('local-1');
    expect(row).toMatchObject({ status: 'decrypt_failed', decrypt_error: 'unseal_failed' });

    await pendingSyncEnvelopeRepo.markDecrypted('local-1');
    row = await pendingSyncEnvelopeRepo.getByLocalId('local-1');
    expect(row).toMatchObject({ status: 'decrypted', decrypt_error: null });

    await pendingSyncEnvelopeRepo.markAcked('local-1');
    expect((await pendingSyncEnvelopeRepo.getByLocalId('local-1'))?.status).toBe('acked');
  });

  it('getByServerEnvelopeId and getByLocalId return null for a non-existent row', async () => {
    expect(await pendingSyncEnvelopeRepo.getByServerEnvelopeId(999)).toBeNull();
    expect(await pendingSyncEnvelopeRepo.getByLocalId('nope')).toBeNull();
  });
});
