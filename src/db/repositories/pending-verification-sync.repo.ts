import { getDb } from '@/db/client';

export type PendingVerificationSync = {
  local_id: string;
  patient_id: number;
  envelope_type: string;
  item_identifier: string;
  verified: boolean;
  synced: boolean;
  created_at: string;
};

/**
 * Insert a pending verification sync record.
 * Uses INSERT OR REPLACE to handle idempotency (last write wins).
 */
export async function insert(params: {
  localId: string;
  patientId: number;
  envelopeType: string;
  itemIdentifier: string;
  verified: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO pending_verification_syncs 
     (local_id, patient_id, envelope_type, item_identifier, verified, synced, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    params.localId,
    params.patientId,
    params.envelopeType,
    params.itemIdentifier,
    params.verified ? 1 : 0,
    new Date().toISOString(),
  );
}

/**
 * Get all unsynced verification records.
 */
export async function getUnsynced(): Promise<PendingVerificationSync[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    local_id: string;
    patient_id: number;
    envelope_type: string;
    item_identifier: string;
    verified: number;
    synced: number;
    created_at: string;
  }>('SELECT * FROM pending_verification_syncs WHERE synced = 0 ORDER BY created_at ASC');

  return rows.map(r => ({
    ...r,
    verified: r.verified === 1,
    synced: r.synced === 1,
  }));
}

/**
 * Mark a verification sync record as synced.
 */
export async function markSynced(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE pending_verification_syncs SET synced = 1 WHERE local_id = ?',
    localId,
  );
}

/**
 * Get all pending verification records for a specific patient.
 * Returns both synced and unsynced records.
 */
export async function getForPatient(patientId: number): Promise<PendingVerificationSync[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    local_id: string;
    patient_id: number;
    envelope_type: string;
    item_identifier: string;
    verified: number;
    synced: number;
    created_at: string;
  }>(
    'SELECT * FROM pending_verification_syncs WHERE patient_id = ? ORDER BY created_at DESC',
    patientId,
  );

  return rows.map(r => ({
    ...r,
    verified: r.verified === 1,
    synced: r.synced === 1,
  }));
}

/**
 * Get the latest verification status for a patient from local pending records.
 * Returns a map of item_identifier -> verified status.
 */
async function getLatestVerificationsForPatient(
  patientId: number,
): Promise<Map<string, Map<string, boolean>>> {
  const records = await getForPatient(patientId);

  // Group by envelope_type, then by item_identifier
  const result = new Map<string, Map<string, boolean>>();

  for (const record of records) {
    if (!result.has(record.envelope_type)) {
      result.set(record.envelope_type, new Map());
    }
    const typeMap = result.get(record.envelope_type)!;

    // Only set if not already set (first record is latest due to ORDER BY created_at DESC)
    if (!typeMap.has(record.item_identifier)) {
      typeMap.set(record.item_identifier, record.verified);
    }
  }

  return result;
}
