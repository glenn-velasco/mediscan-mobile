import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as deviceKeyRepo from '@/db/repositories/device-key.repo';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));

beforeEach(async () => {
  const db = createNodeSqliteAdapter();
  await runMigrations(db);
  (getDb as jest.Mock).mockResolvedValue(db);
  setCurrentUserId(0);
});

describe('device-key.repo', () => {
  it('returns null before any key is registered', async () => {
    expect(await deviceKeyRepo.getLocal()).toBeNull();
  });

  it('saveRegistered writes a row readable via getLocal, and re-saving replaces it (upsert on id=1)', async () => {
    await deviceKeyRepo.saveRegistered({
      serverDeviceKeyId: 1,
      publicKey: 'pubkey-a',
      label: 'iPhone',
      registeredAt: '2026-01-01T00:00:00.000Z',
    });

    const first = await deviceKeyRepo.getLocal();
    expect(first).toMatchObject({ server_device_key_id: 1, public_key: 'pubkey-a', label: 'iPhone', is_active: 1 });

    await deviceKeyRepo.saveRegistered({
      serverDeviceKeyId: 2,
      publicKey: 'pubkey-b',
      label: 'Pixel',
      registeredAt: '2026-02-01T00:00:00.000Z',
    });

    const db = await getDb();
    const rows = await db.getAllAsync('SELECT * FROM device_keys');
    expect(rows).toHaveLength(1);
    const second = await deviceKeyRepo.getLocal();
    expect(second).toMatchObject({ server_device_key_id: 2, public_key: 'pubkey-b', label: 'Pixel' });
  });

  it('markPendingRevoke sets pending_revoke_server_id, clearPendingRevoke clears it', async () => {
    await deviceKeyRepo.saveRegistered({ serverDeviceKeyId: 1, publicKey: 'pk', label: null, registeredAt: 'now' });

    await deviceKeyRepo.markPendingRevoke(1);
    expect((await deviceKeyRepo.getLocal())?.pending_revoke_server_id).toBe(1);

    await deviceKeyRepo.clearPendingRevoke();
    expect((await deviceKeyRepo.getLocal())?.pending_revoke_server_id).toBeNull();
  });

  it('clear removes the local row', async () => {
    await deviceKeyRepo.saveRegistered({ serverDeviceKeyId: 1, publicKey: 'pk', label: null, registeredAt: 'now' });
    await deviceKeyRepo.clear();
    expect(await deviceKeyRepo.getLocal()).toBeNull();
  });
});
