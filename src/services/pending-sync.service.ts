import * as Crypto from 'expo-crypto';

import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import { hasCurrentUser } from '@/db/context';
import { getPendingSync, ackEnvelope } from '@/api/endpoints/pending-sync';
import { processEnvelope } from '@/services/merge.service';
import { backoffDelayMs } from '@/lib/backoff';
import { getCachedToken } from '@/auth/token-storage';
import { NetworkError, UnauthenticatedError } from '@/api/errors';
import { getIsOffline } from '@/lib/network-state';
import type { EnvelopeType } from '@/api/types';

const TAG = '[PendingSyncService]';

let isProcessing = false;
let consecutiveFailures = 0;
let lastFailureAt = 0;

function withinBackoffWindow(): boolean {
  if (consecutiveFailures === 0) return false;
  return Date.now() < lastFailureAt + backoffDelayMs(consecutiveFailures - 1);
}

/** Clears the retry backoff so a fresh login doesn't inherit a stale delay from before the user logged out. */
export function resetPendingSyncBackoff(): void {
  consecutiveFailures = 0;
  lastFailureAt = 0;
}

/**
 * Fetches new envelopes from the relay, decrypts/merges each unprocessed one, and acknowledges only the
 * ones that were successfully merged — a decrypt failure is left un-acked for the user to see on the
 * status screen, never silently retried automatically. Single-flight guarded so overlapping triggers
 * (NetInfo reconnect, AppState foreground, the periodic interval) don't race each other.
 */
export async function pullPendingSync(): Promise<void> {
  if (!getCachedToken()) return;
  if (!hasCurrentUser()) return;
  if (getIsOffline()) return;
  if (isProcessing) return;
  if (withinBackoffWindow()) return;

  isProcessing = true;
  try {
    const { envelopes } = await getPendingSync();
    await Promise.all(envelopes.map(async (envelope) => {
      const existing = await pendingSyncEnvelopeRepo.getByServerEnvelopeId(envelope.id);
      if (existing) return;
      await pendingSyncEnvelopeRepo.insertReceived({
        localId: Crypto.randomUUID(),
        serverEnvelopeId: envelope.id,
        transport: 'relay',
        senderId: envelope.sender_id,
        envelopeType: envelope.envelope_type as EnvelopeType,
        ciphertext: envelope.ciphertext,
        expiresAt: envelope.expires_at,
      });
    }));

    const unprocessed = await pendingSyncEnvelopeRepo.getUnprocessed();
    await Promise.all(unprocessed.map(async (row) => {
      const result = await processEnvelope(row);
      if (result === 'merged' && row.server_envelope_id != null) {
        await ackEnvelope(row.server_envelope_id);
        await pendingSyncEnvelopeRepo.markAcked(row.local_id);
      }
    }));

    consecutiveFailures = 0;
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) {
      consecutiveFailures += 1;
      lastFailureAt = Date.now();
      console.warn(TAG, 'pull failed, will retry on next trigger', { error: String(err), consecutiveFailures });
    } else {
      console.error(TAG, 'unexpected error during pull', { error: String(err) });
    }
  } finally {
    isProcessing = false;
  }
}
