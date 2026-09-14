import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { decryptRecentScan, encryptRecentScan } from '@/services/recent-scan-crypto.service';
import type { QrVerificationResult, RecentEmergencyScan, ResponderEncounter, ResponderNote, ResponderNoteBlock } from '@/types/emergency';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type StoredSnapshot = {
  info: ScannedEmergencyInfo;
  verification: QrVerificationResult;
  source?: 'qr' | 'dynamic-card' | 'printable-offline';
  note: ResponderNote | null;
  encounter?: ResponderEncounter | null;
};

type ScanRow = {
  id: string;
  payload_hash: string;
  encrypted_snapshot: string;
  scanned_at: string;
  last_viewed_at: string;
  expires_at: string;
  scan_count: number;
};

async function decode(row: ScanRow): Promise<RecentEmergencyScan | null> {
  try {
    const snapshot = await decryptRecentScan<StoredSnapshot>(row.encrypted_snapshot);
    if (!snapshot) return null;
    return {
      id: row.id,
      payloadHash: row.payload_hash,
      info: snapshot.info,
      verification: snapshot.verification,
      source: snapshot.source ?? 'qr',
      scannedAt: row.scanned_at,
      lastViewedAt: row.last_viewed_at,
      expiresAt: row.expires_at,
      scanCount: row.scan_count,
      note: snapshot.note,
      encounter: snapshot.encounter ?? null,
    };
  } catch {
    return null;
  }
}

export async function purgeExpired(now = new Date()): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recent_emergency_scans WHERE expires_at <= ?', now.toISOString());
}

export async function saveScan(rawPayload: string, info: ScannedEmergencyInfo, verification: QrVerificationResult, source: 'qr' | 'dynamic-card' | 'printable-offline' = 'qr'): Promise<string> {
  const db = await getDb();
  const now = new Date();
  await purgeExpired(now);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawPayload);
  const existing = await db.getFirstAsync<ScanRow>('SELECT * FROM recent_emergency_scans WHERE payload_hash = ?', hash);
  if (existing) {
    await db.runAsync(
      'UPDATE recent_emergency_scans SET last_viewed_at = ?, expires_at = ?, scan_count = scan_count + 1 WHERE id = ?',
      now.toISOString(),
      new Date(now.getTime() + RETENTION_MS).toISOString(),
      existing.id,
    );
    return existing.id;
  }

  const id = Crypto.randomUUID();
  const encrypted = await encryptRecentScan({ info, verification, source, note: null, encounter: null } satisfies StoredSnapshot);
  await db.runAsync(
    `INSERT INTO recent_emergency_scans
      (id, payload_hash, encrypted_snapshot, scanned_at, last_viewed_at, expires_at, scan_count)
      VALUES (?, ?, ?, ?, ?, ?, 1)`,
    id,
    hash,
    encrypted,
    now.toISOString(),
    now.toISOString(),
    new Date(now.getTime() + RETENTION_MS).toISOString(),
  );
  return id;
}

export async function getAll(): Promise<RecentEmergencyScan[]> {
  await purgeExpired();
  const db = await getDb();
  const rows = await db.getAllAsync<ScanRow>('SELECT * FROM recent_emergency_scans ORDER BY last_viewed_at DESC');
  const decoded = await Promise.all(rows.map(decode));
  return decoded.filter((row): row is RecentEmergencyScan => row !== null);
}

export async function getById(id: string): Promise<RecentEmergencyScan | null> {
  await purgeExpired();
  const db = await getDb();
  const row = await db.getFirstAsync<ScanRow>('SELECT * FROM recent_emergency_scans WHERE id = ?', id);
  if (!row) return null;
  const decoded = await decode(row);
  if (decoded) {
    await db.runAsync('UPDATE recent_emergency_scans SET last_viewed_at = ? WHERE id = ?', new Date().toISOString(), id);
  }
  return decoded;
}

export async function setNote(id: string, text: string, photoUris: string[] = []): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<ScanRow>('SELECT * FROM recent_emergency_scans WHERE id = ?', id);
  if (!row) return;
  const snapshot = await decryptRecentScan<StoredSnapshot>(row.encrypted_snapshot);
  if (!snapshot) return;
  const trimmed = text.trim().slice(0, 2000);
  snapshot.note = trimmed || photoUris.length ? { text: trimmed, updatedAt: new Date().toISOString(), ...(photoUris.length ? { photoUris } : {}) } : null;
  await db.runAsync('UPDATE recent_emergency_scans SET encrypted_snapshot = ? WHERE id = ?', await encryptRecentScan(snapshot), id);
}

export async function setNoteBlocks(id: string, blocks: ResponderNoteBlock[], title = ''): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<ScanRow>('SELECT * FROM recent_emergency_scans WHERE id = ?', id);
  if (!row) return;
  const snapshot = await decryptRecentScan<StoredSnapshot>(row.encrypted_snapshot);
  if (!snapshot) return;
  const normalized = blocks.filter((block) => block.type === 'image' || block.text.trim()).slice(0, 40);
    snapshot.note = normalized.length || title.trim() ? { text: normalized.filter((block) => block.type === 'text').map((block) => block.text).join('\n\n'), updatedAt: new Date().toISOString(), title: title.trim() || undefined, blocks: normalized } : null;
  await db.runAsync('UPDATE recent_emergency_scans SET encrypted_snapshot = ? WHERE id = ?', await encryptRecentScan(snapshot), id);
}

export async function setEncounter(id: string, encounter: ResponderEncounter): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<ScanRow>('SELECT * FROM recent_emergency_scans WHERE id = ?', id);
  if (!row || row.expires_at <= new Date().toISOString()) throw new Error('This scan has expired.');
  const snapshot = await decryptRecentScan<StoredSnapshot>(row.encrypted_snapshot);
  if (!snapshot) throw new Error('Unable to open this scan.');
  snapshot.encounter = encounter;
  await db.runAsync('UPDATE recent_emergency_scans SET encrypted_snapshot = ? WHERE id = ?', await encryptRecentScan(snapshot), id);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recent_emergency_scans WHERE id = ?', id);
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recent_emergency_scans');
}
