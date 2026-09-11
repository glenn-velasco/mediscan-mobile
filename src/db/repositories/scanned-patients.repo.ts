import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import type { ScannedPatientRow } from '@/db/schema';
import type { ScanSummary } from '@/api/types';

/**
 * Get all scanned patients for the current professional, ordered by last scanned date.
 */
export async function getAll(): Promise<ScannedPatientRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  return db.getAllAsync<ScannedPatientRow>(
    'SELECT * FROM scanned_patients WHERE professional_id = ? ORDER BY last_scanned_at DESC',
    userId,
  );
}

/**
 * Get a specific scanned patient by their server ID.
 */
export async function getByPatientId(patientServerId: number): Promise<ScannedPatientRow | null> {
  const db = await getDb();
  const userId = getCurrentUserId();
  return db.getFirstAsync<ScannedPatientRow>(
    'SELECT * FROM scanned_patients WHERE patient_server_id = ? AND professional_id = ?',
    patientServerId,
    userId,
  );
}

/**
 * Search scanned patients by name (local filter).
 */
export async function search(query: string): Promise<ScannedPatientRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const pattern = `%${query}%`;
  return db.getAllAsync<ScannedPatientRow>(
    'SELECT * FROM scanned_patients WHERE professional_id = ? AND fullname LIKE ? ORDER BY last_scanned_at DESC',
    userId,
    pattern,
  );
}

/**
 * Upsert a scanned patient from API data.
 * Uses composite primary key (patient_server_id, professional_id).
 */
export async function upsertFromApi(item: ScanSummary): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO scanned_patients (patient_server_id, professional_id, fullname, avatar_url, age, gender, dob, notes, scan_count, last_scanned_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(patient_server_id, professional_id) DO UPDATE SET
       fullname = excluded.fullname,
       avatar_url = excluded.avatar_url,
       age = excluded.age,
       gender = excluded.gender,
       dob = excluded.dob,
       notes = excluded.notes,
       scan_count = excluded.scan_count,
       last_scanned_at = excluded.last_scanned_at,
       synced_at = excluded.synced_at`,
    item.id,
    userId,
    item.fullname,
    item.avatar,
    item.age,
    item.gender,
    item.dob,
    item.notes,
    item.scan_count,
    item.last_scanned_at,
    now,
  );
}

/**
 * Upsert multiple scanned patients from API response.
 */
export async function upsertManyFromApi(items: ScanSummary[]): Promise<void> {
  for (const item of items) {
    await upsertFromApi(item);
  }
}

/**
 * Update notes for a scanned patient.
 */
export async function updateNotes(patientServerId: number, notes: string | null): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  await db.runAsync(
    'UPDATE scanned_patients SET notes = ?, synced_at = ? WHERE patient_server_id = ? AND professional_id = ?',
    notes,
    new Date().toISOString(),
    patientServerId,
    userId,
  );
}

/**
 * Insert or update a scanned patient from a BLE scan event envelope.
 * The professional scanned this patient; upsert the record.
 */
export async function insertScanEvent(patientServerId: number, patientFullname: string, scannedAt: string): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO scanned_patients (patient_server_id, professional_id, fullname, avatar_url, age, gender, dob, notes, scan_count, last_scanned_at, synced_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
     ON CONFLICT(patient_server_id, professional_id) DO UPDATE SET
       scan_count = scan_count + 1,
       last_scanned_at = excluded.last_scanned_at,
       synced_at = excluded.synced_at`,
    patientServerId,
    userId,
    patientFullname,
    scannedAt,
    now,
  );
}

/**
 * Delete all scanned patients for the current professional (used on logout).
 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  await db.runAsync('DELETE FROM scanned_patients WHERE professional_id = ?', userId);
}

/**
 * Convert a ScannedPatientRow to a ScanSummary for display.
 */
export function toScanSummary(row: ScannedPatientRow): ScanSummary {
  return {
    id: row.patient_server_id,
    fullname: row.fullname,
    avatar: row.avatar_url,
    age: row.age,
    gender: row.gender as ScanSummary['gender'],
    dob: row.dob,
    notes: row.notes,
    scan_count: row.scan_count,
    last_scanned_at: row.last_scanned_at,
  };
}
