import { getDb } from '@/db/client';
import { decryptJson, encryptJson } from '@/lib/crypto';

export type LocalDynamicEmergencyCard = {
  token: string;
  issuedAt: string;
  pendingPublish: boolean;
  lastPublishedAt: string | null;
  lastErrorAt: string | null;
};

export async function getDynamicCard(userId: string | number): Promise<LocalDynamicEmergencyCard | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    encrypted_token: string;
    issued_at: string;
    pending_publish: number;
    last_published_at: string | null;
    last_error_at: string | null;
  }>('SELECT * FROM dynamic_emergency_cards WHERE user_id = ?', String(userId));
  if (!row) return null;
  const token = await decryptJson<string>(row.encrypted_token);
  if (!token) return null;
  return {
    token,
    issuedAt: row.issued_at,
    pendingPublish: row.pending_publish === 1,
    lastPublishedAt: row.last_published_at,
    lastErrorAt: row.last_error_at,
  };
}

export async function saveDynamicCard(userId: string | number, token: string, issuedAt: string): Promise<void> {
  const db = await getDb();
  const encryptedToken = await encryptJson(token);
  await db.runAsync(
    `INSERT INTO dynamic_emergency_cards (user_id, encrypted_token, issued_at, pending_publish)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET encrypted_token = excluded.encrypted_token,
       issued_at = excluded.issued_at, pending_publish = 1, last_published_at = NULL, last_error_at = NULL`,
    String(userId), encryptedToken, issuedAt,
  );
}

export async function markDynamicCardPending(userId: string | number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE dynamic_emergency_cards SET pending_publish = 1 WHERE user_id = ?', String(userId));
}

export async function markDynamicCardPublished(userId: string | number, publishedAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE dynamic_emergency_cards SET pending_publish = 0, last_published_at = ?, last_error_at = NULL WHERE user_id = ?',
    publishedAt, String(userId),
  );
}

export async function markDynamicCardPublishFailed(userId: string | number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE dynamic_emergency_cards SET pending_publish = 1, last_error_at = ? WHERE user_id = ?',
    new Date().toISOString(), String(userId),
  );
}

export async function removeDynamicCard(userId: string | number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM dynamic_emergency_cards WHERE user_id = ?', String(userId));
}
