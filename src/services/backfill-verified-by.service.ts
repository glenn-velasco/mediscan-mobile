import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import type { VerifiedByEntry } from '@/db/schema';

const TAG = '[BackfillVerifiedBy]';

/**
 * Backfill the `verified_by` column from existing `professional_attestations`.
 * Run once after migration 016 to populate BLE-only verifications that never hit the server.
 */
export async function backfillVerifiedBy(): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  
  console.debug(TAG, 'Starting backfill for user', { userId });
  
  const attestations = await professionalAttestationRepo.getAll();
  
  const allUpdates: Promise<void>[] = [];

  for (const att of attestations) {
    const payload = att.payload as { verified_by?: { user_id: number; name: string }; verified_at?: string };
    if (!payload.verified_by || !payload.verified_at) continue;
    
    const entry: VerifiedByEntry = {
      user_id: payload.verified_by.user_id,
      name: payload.verified_by.name,
      verified_at: payload.verified_at,
    };
    
    if (att.matched_allergy_local_uuid) {
      allUpdates.push(addToTable(db, 'allergies', att.matched_allergy_local_uuid, entry));
    }
    
    if (att.matched_condition_local_uuid) {
      allUpdates.push(addToTable(db, 'conditions', att.matched_condition_local_uuid, entry));
    }
    
    if (att.matched_diagnosis_local_uuid) {
      allUpdates.push(addToTable(db, 'diagnoses', att.matched_diagnosis_local_uuid, entry));
    }
    
    if (att.matched_medication_local_uuid) {
      allUpdates.push(addToTable(db, 'medications', att.matched_medication_local_uuid, entry));
    }
  }

  await Promise.all(allUpdates);

  console.debug(TAG, 'Backfill complete', { count: allUpdates.length });
}

async function addToTable(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  localUuid: string,
  entry: VerifiedByEntry,
): Promise<void> {
  const row = await db.getFirstAsync<{ verified_by: string | null }>(
    `SELECT verified_by FROM ${table} WHERE local_uuid = ?`,
    localUuid,
  );
  
  if (!row) return;
  
  const current: VerifiedByEntry[] = (() => {
    if (!row.verified_by) return [];
    if (Array.isArray(row.verified_by)) return row.verified_by;
    try {
      const parsed = JSON.parse(row.verified_by);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  
  // Skip if already exists (idempotent)
  if (current.some(v => v.user_id === entry.user_id)) return;
  
  current.push(entry);
  
  await db.runAsync(
    `UPDATE ${table} SET verified_by = ?, updated_at_local = ? WHERE local_uuid = ?`,
    JSON.stringify(current),
    new Date().toISOString(),
    localUuid,
  );
}
