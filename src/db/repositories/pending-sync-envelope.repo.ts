import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import type { EnvelopeTransport, PendingSyncEnvelopeRow } from '@/db/schema';

/** Idempotent on server_envelope_id (enforced by the partial unique index) — a re-poll of an un-acked envelope inserts nothing new. */
export async function insertReceived(params: {
  localId: string;
  serverEnvelopeId: number | null;
  transport: EnvelopeTransport;
  senderId: number | null;
  envelopeType: string;
  ciphertext: string;
  expiresAt: string | null;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  if (params.serverEnvelopeId != null) {
    const existing = await getByServerEnvelopeId(params.serverEnvelopeId);
    if (existing) return;
  }

  await db.runAsync(
    `INSERT INTO pending_sync_envelopes
       (local_id, user_id, server_envelope_id, transport, sender_id, envelope_type, ciphertext, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
    params.localId,
    userId,
    params.serverEnvelopeId,
    params.transport,
    params.senderId,
    params.envelopeType,
    params.ciphertext,
    params.expiresAt,
    new Date().toISOString(),
  );
}

export async function getUnprocessed(): Promise<PendingSyncEnvelopeRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  return db.getAllAsync<PendingSyncEnvelopeRow>(
    `SELECT * FROM pending_sync_envelopes WHERE user_id = ? AND status = 'received' ORDER BY created_at ASC`,
    userId,
  );
}

export async function getByServerEnvelopeId(serverEnvelopeId: number): Promise<PendingSyncEnvelopeRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PendingSyncEnvelopeRow>(
    'SELECT * FROM pending_sync_envelopes WHERE server_envelope_id = ?',
    serverEnvelopeId,
  );
  return row ?? null;
}

/** BLE-received envelopes have no server_envelope_id, so the local writer looks the row back up by local_id instead. */
export async function getByLocalId(localId: string): Promise<PendingSyncEnvelopeRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PendingSyncEnvelopeRow>(
    'SELECT * FROM pending_sync_envelopes WHERE local_id = ?',
    localId,
  );
  return row ?? null;
}

export async function getAll(): Promise<PendingSyncEnvelopeRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  return db.getAllAsync<PendingSyncEnvelopeRow>(
    'SELECT * FROM pending_sync_envelopes WHERE user_id = ? ORDER BY created_at DESC',
    userId,
  );
}

async function markStatus(localId: string, status: PendingSyncEnvelopeRow['status'], decryptError?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_sync_envelopes SET status = ?, decrypt_error = ?, processed_at = ? WHERE local_id = ?`,
    status,
    decryptError ?? null,
    new Date().toISOString(),
    localId,
  );
}

export const markDecrypted = (localId: string) => markStatus(localId, 'decrypted');
export const markMerged = (localId: string) => markStatus(localId, 'merged');
export const markAcked = (localId: string) => markStatus(localId, 'acked');
export const markExpired = (localId: string) => markStatus(localId, 'expired');
export const markDecryptFailed = (localId: string, error: string) => markStatus(localId, 'decrypt_failed', error);
