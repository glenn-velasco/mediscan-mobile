import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_SNAPSHOT_BYTES = 24_000;
const HISTORY_FIELDS = new Set(['date_of_birth', 'blood_type', 'no_blood_transfusion']);
const HISTORY_BLOOD_TYPES = new Set(['a_positive', 'a_negative', 'b_positive', 'b_negative', 'ab_positive', 'ab_negative', 'o_positive', 'o_negative']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLOUD_PREFIX = 'gcm1:';
const MAX_CLOUD_ITEMS = 100;
const MAX_CLOUD_JSON_BYTES = 64_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VITAL_KINDS = new Set(['blood_pressure', 'heart_rate', 'respiratory_rate', 'temperature', 'oxygen_saturation']);

function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.role === 'admin';
}

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return base64Bytes(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function googleAccessToken(): Promise<string | null> {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replaceAll('\\n', '\n');
  if (!projectId || !email || !privateKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/cloud-vision', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${base64Url(new Uint8Array(signature))}` }) });
  if (!response.ok) throw new Error('Google Cloud authentication failed');
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error('Google Cloud authentication failed');
  return result.access_token;
}

function extractPrcFields(text: string): Record<string, string | null> {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const field = (labels: string[]): string | null => {
    for (let index = 0; index < lines.length; index += 1) {
      for (const label of labels) {
        const match = lines[index].match(new RegExp(`^${label}\\s*[:.-]?\\s*(.*)$`, 'i'));
        if (!match) continue;
        return match[1]?.trim() || lines[index + 1]?.trim() || null;
      }
    }
    return null;
  };
  const firstName = field(['FIRST\\s*NAME']);
  const middleName = field(['MIDDLE\\s*NAME']);
  const lastName = field(['LAST\\s*NAME', 'SURNAME']);
  const stackedNames = collapsed.match(/LAST\s*NAME\s+FIRST\s*NAME\s+MIDDLE\s*NAME\s+(.+?)\s+REGISTRATION\s*(?:NO\.?|NUMBER|#)/i)?.[1]
    ?.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const stackedParts = stackedNames?.split(' ').filter(Boolean) ?? [];
  const stackedLast = stackedParts.length >= 3 ? stackedParts[0] : null;
  const stackedMiddle = stackedParts.length >= 3 ? stackedParts.at(-1) ?? null : null;
  const stackedFirst = stackedParts.length >= 3 ? stackedParts.slice(1, -1).join(' ') : null;
  const registrationNumber = collapsed.match(/REGISTRATION\s*(?:NO\.?|NUMBER|#)\s*[^A-Z0-9]*([A-Z0-9-]{5,20})/i)?.[1] ?? null;
  const registrationDate = collapsed.match(/REGISTRATION\s*DATE\s*[^0-9]*([0-9]{1,4}[\/-][0-9]{1,2}[\/-][0-9]{1,4})/i)?.[1] ?? null;
  return {
    full_name: stackedFirst && stackedMiddle && stackedLast
      ? [stackedFirst, stackedMiddle, stackedLast].join(' ')
      : [firstName, middleName, lastName].filter((part) => part && !/\b(?:FIRST|MIDDLE|LAST)\s*NAME\b/i.test(part)).join(' ') || field(['FULL\\s*NAME', 'NAME']),
    registration_number: registrationNumber ?? field(['REGISTRATION\\s*(?:NO\\.?|NUMBER|#)', 'LICENSE\\s*(?:NO\\.?|NUMBER|#)', 'LICENCE\\s*(?:NO\\.?|NUMBER|#)']),
    registration_date: registrationDate ?? field(['REGISTRATION\\s*DATE', 'DATE\\s*OF\\s*REGISTRATION']),
    id_type: 'Philippine PRC Professional Identification Card',
    profession: field(['PROFESSION']),
  };
}

async function screenPrcId(bytes: Uint8Array): Promise<{ status: 'passed' | 'failed' | 'unavailable'; result: Record<string, unknown>; reason?: string }> {
  const token = await googleAccessToken();
  if (!token) return { status: 'unavailable', result: { message: 'Google Cloud Vision is not configured' } };
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ image: { content: base64Bytes(bytes) }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }) });
  if (!response.ok) throw new Error('ID screening service is unavailable');
  const body = await response.json() as { responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }> };
  const text = body.responses?.[0]?.fullTextAnnotation?.text?.trim() ?? '';
  if (body.responses?.[0]?.error || text.length < 25) return { status: 'failed', result: { text_length: text.length }, reason: 'The PRC ID could not be read. Retake it in bright, even light with all edges visible.' };
  const normalized = text.toUpperCase();
  const looksLikePrc = normalized.includes('PROFESSIONAL REGULATION COMMISSION') || normalized.includes('PRC');
  const fields = extractPrcFields(text);
  if (!looksLikePrc) return { status: 'failed', result: { text_length: text.length }, reason: 'This does not appear to be a readable Philippine PRC ID. Please retake the correct ID.' };
  return { status: 'passed', result: { ...fields, license_number: fields.registration_number } };
}

function base64Bytes(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 8192));
  }
  return btoa(binary);
}

async function sealCloudValue(value: unknown, userId: string): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  if (plaintext.byteLength > MAX_CLOUD_JSON_BYTES) throw new Error('Patient record is too large');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(`patient:${userId}`) },
    await historyKey(), plaintext,
  ));
  const encoded = new Uint8Array(nonce.length + ciphertext.length);
  encoded.set(nonce);
  encoded.set(ciphertext, nonce.length);
  return CLOUD_PREFIX + base64Bytes(encoded);
}

async function openCloudValue(value: string, userId: string): Promise<unknown> {
  if (!value.startsWith(CLOUD_PREFIX) || value.length > MAX_CLOUD_JSON_BYTES * 2) {
    throw new Error('Unsupported patient record encryption version');
  }
  const bytes = Uint8Array.from(atob(value.slice(CLOUD_PREFIX.length)), (character) => character.charCodeAt(0));
  if (bytes.length < 29) throw new Error('Invalid patient record');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(`patient:${userId}`) },
    await historyKey(), bytes.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function historyKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('HISTORY_MASTER_KEY_B64');
  if (!encoded) throw new Error('Emergency history encryption is not configured');
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('Emergency history encryption key must be 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function sealHistoryValue(value: string | null): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, await historyKey(), new TextEncoder().encode(JSON.stringify(value)),
  ));
  return btoa(String.fromCharCode(...nonce, ...ciphertext));
}

async function openHistoryValue(encoded: string): Promise<string | null> {
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) }, await historyKey(), bytes.slice(12),
  );
  const value = JSON.parse(new TextDecoder().decode(plaintext));
  return typeof value === 'string' || value === null ? value : null;
}

async function decodeHistoryRows(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const decoded: Record<string, unknown>[] = [];
  for (const row of rows) {
    try {
      decoded.push({
        id: row.id, field: row.field_key,
        value: await openHistoryValue(String(row.encrypted_value)),
        changedAt: row.changed_at_local,
        serverRecordedAt: row.server_recorded_at,
        syncStatus: 'synced',
      });
    } catch {
      // A damaged event is never exposed as a confirmed value.
    }
  }
  return decoded;
}

function disclosedHistoryFields(qrPayload: string): Set<string> {
  const allowed = new Set<string>();
  try {
    if (!qrPayload.startsWith('MEDISCAN:v2:')) return allowed;
    const encoded = qrPayload.slice('MEDISCAN:v2:'.length).replaceAll('-', '+').replaceAll('_', '/');
    const envelope = JSON.parse(atob(encoded)) as { data?: Record<string, unknown> };
    if (envelope.data?.dateOfBirth) allowed.add('date_of_birth');
    if (envelope.data?.bloodType) allowed.add('blood_type');
    if (envelope.data?.noBloodTransfusion) allowed.add('no_blood_transfusion');
  } catch {
    // A malformed snapshot cannot grant history disclosure.
  }
  return allowed;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomCardToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const contentType = req.headers.get('content-type') ?? '';
  let action: string;
  let payload: Record<string, unknown>;
  let form: FormData | null = null;
  if (contentType.includes('multipart/form-data')) {
    form = await req.formData(); action = String(form.get('action') ?? ''); payload = Object.fromEntries(form.entries());
  } else {
    const body = await req.json(); action = String(body.action ?? ''); payload = body.payload ?? {};
  }

  // This is the sole anonymous action. It returns the same response for missing, malformed,
  // revoked, and unpublished cards so callers cannot probe patient existence.
  if (action === 'emergency-card-resolve') {
    const token = typeof payload.token === 'string' ? payload.token : '';
    const requester = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const requesterHash = await sha256(`${serviceKey}:${requester}`);
    const tokenPrefixHash = await sha256(token.slice(0, 8));
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('dynamic_emergency_card_lookup_attempts')
      .select('id', { count: 'exact', head: true }).eq('requester_hash', requesterHash).gte('created_at', since);
    if ((count ?? 0) >= 60) return json({ message: 'Emergency card unavailable' }, 429);

    let snapshot: { patient_id: string; snapshot_payload: string; snapshot_generated_at: string; published_at: string } | null = null;
    if (CARD_TOKEN_PATTERN.test(token)) {
      const tokenHash = await sha256(token);
      const { data } = await admin.from('dynamic_emergency_cards')
        .select('patient_id,snapshot_payload,snapshot_generated_at,published_at')
        .eq('token_hash', tokenHash).is('revoked_at', null).not('snapshot_payload', 'is', null).maybeSingle();
      snapshot = data;
    }
    await admin.from('dynamic_emergency_card_lookup_attempts').insert({
      requester_hash: requesterHash,
      token_prefix_hash: tokenPrefixHash,
      succeeded: Boolean(snapshot),
    });
    if (!snapshot) return json({ message: 'Emergency card unavailable' }, 404);
    const allowed = disclosedHistoryFields(snapshot.snapshot_payload);
    const { data: historyRows } = allowed.size
      ? await admin.from('emergency_field_history')
        .select('id,field_key,encrypted_value,changed_at_local,server_recorded_at')
        .eq('user_id', snapshot.patient_id).in('field_key', [...allowed])
        .lte('server_recorded_at', snapshot.published_at)
        .order('server_recorded_at', { ascending: false }).limit(5)
      : { data: [] };
    return json({
      qr_payload: snapshot.snapshot_payload,
      snapshot_generated_at: snapshot.snapshot_generated_at,
      published_at: snapshot.published_at,
      recent_history: await decodeHistoryRows(historyRows ?? []),
    });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ message: 'Authentication required' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ message: 'Invalid session' }, 401);

  const professional = async () => {
    const { data } = await admin.from('profiles').select('professional_verified_at').eq('id', user.id).single();
    if (!data?.professional_verified_at) throw new Error('Verified professional access required');
  };

  try {
    switch (action) {
      case 'patient-crypto-seal': {
        if (!Object.hasOwn(payload, 'value')) return json({ message: 'Invalid patient record' }, 422);
        return json({ encrypted_payload: await sealCloudValue(payload.value, user.id) });
      }
      case 'patient-crypto-open': {
        const values = payload.values;
        if (!Array.isArray(values) || values.length > MAX_CLOUD_ITEMS || values.some((value) => typeof value !== 'string')) {
          return json({ message: 'Invalid patient record batch' }, 422);
        }
        return json({ values: await Promise.all(values.map((value) => openCloudValue(value, user.id))) });
      }
      case 'emergency-history-push': {
        const events = payload.events;
        if (!Array.isArray(events) || events.length < 1 || events.length > 50) return json({ message: 'Invalid history batch' }, 422);
        const validated: Record<string, unknown>[] = [];
        for (const event of events) {
          if (!event || typeof event !== 'object') return json({ message: 'Invalid history event' }, 422);
          const item = event as Record<string, unknown>;
          if (typeof item.id !== 'string' || !UUID_PATTERN.test(item.id)
            || typeof item.field !== 'string' || !HISTORY_FIELDS.has(item.field)
            || (item.value !== null && (typeof item.value !== 'string' || item.value.length > 80))
            || typeof item.changedAt !== 'string' || !Number.isFinite(Date.parse(item.changedAt))) {
            return json({ message: 'Invalid history event' }, 422);
          }
          if (item.value !== null && (
            (item.field === 'date_of_birth' && !/^\d{4}-\d{2}-\d{2}$/.test(item.value as string))
            || (item.field === 'blood_type' && !HISTORY_BLOOD_TYPES.has(item.value as string))
            || (item.field === 'no_blood_transfusion' && item.value !== 'Yes' && item.value !== 'No')
          )) return json({ message: 'Invalid history value' }, 422);
          validated.push(item);
        }
        const rows = await Promise.all(validated.map(async (item) => ({
          id: item.id, user_id: user.id, field_key: item.field,
          encrypted_value: await sealHistoryValue(item.value as string | null), changed_at_local: item.changedAt,
        })));
        const { error } = await admin.from('emergency_field_history').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
        const { data: recorded, error: recordedError } = await admin.from('emergency_field_history')
          .select('id,server_recorded_at').eq('user_id', user.id).in('id', rows.map((row) => row.id));
        if (recordedError) throw recordedError;
        return json({ recorded: recorded ?? [] });
      }
      case 'emergency-history-pull': {
        const { data, error } = await admin.from('emergency_field_history')
          .select('id,field_key,encrypted_value,changed_at_local,server_recorded_at')
          .eq('user_id', user.id).order('server_recorded_at', { ascending: false }).limit(100);
        if (error) throw error;
        return json({ events: await decodeHistoryRows(data ?? []) });
      }
      case 'emergency-card-create': {
        const { data: existing } = await admin.from('dynamic_emergency_cards')
          .select('id,issued_at,published_at').eq('patient_id', user.id).is('revoked_at', null).maybeSingle();
        if (existing) return json({ status: 'already_exists', issued_at: existing.issued_at, published_at: existing.published_at }, 409);
        const token = randomCardToken();
        const tokenHash = await sha256(token);
        const { data, error } = await admin.from('dynamic_emergency_cards')
          .insert({ patient_id: user.id, token_hash: tokenHash }).select('issued_at').single();
        if (error) throw error;
        return json({ token, issued_at: data.issued_at });
      }
      case 'emergency-card-status': {
        const { data, error } = await admin.from('dynamic_emergency_cards')
          .select('issued_at,published_at,snapshot_generated_at').eq('patient_id', user.id).is('revoked_at', null).maybeSingle();
        if (error) throw error;
        return json(data ? { active: true, ...data } : { active: false });
      }
      case 'emergency-card-publish': {
        const qrPayload = typeof payload.qr_payload === 'string' ? payload.qr_payload : '';
        if (!qrPayload.startsWith('MEDISCAN:v2:') || new TextEncoder().encode(qrPayload).byteLength > MAX_SNAPSHOT_BYTES) {
          return json({ message: 'Invalid emergency snapshot' }, 422);
        }
        const generatedAt = typeof payload.snapshot_generated_at === 'string' && !Number.isNaN(Date.parse(payload.snapshot_generated_at))
          ? payload.snapshot_generated_at : null;
        if (!generatedAt) return json({ message: 'Invalid emergency snapshot' }, 422);
        const publishedAt = new Date().toISOString();
        const { data, error } = await admin.from('dynamic_emergency_cards')
          .update({ snapshot_payload: qrPayload, snapshot_generated_at: generatedAt, published_at: publishedAt, updated_at: publishedAt })
          .eq('patient_id', user.id).is('revoked_at', null).select('published_at').maybeSingle();
        if (error) throw error;
        if (!data) return json({ message: 'Emergency card unavailable' }, 404);
        return json(data);
      }
      case 'emergency-card-revoke': {
        const revokedAt = new Date().toISOString();
        const { error } = await admin.from('dynamic_emergency_cards')
          .update({ revoked_at: revokedAt, snapshot_payload: null, updated_at: revokedAt })
          .eq('patient_id', user.id).is('revoked_at', null);
        if (error) throw error;
        return json(null);
      }
      case 'patient-handoff-create': {
        const info = payload.info;
        if (!info || typeof info !== 'object' || Array.isArray(info)) return json({ message: 'Invalid patient handoff' }, 422);
        const patientId = String((info as Record<string, unknown>).patientId ?? '');
        if (!UUID_PATTERN.test(patientId)) return json({ message: 'This patient cannot be handed off online' }, 422);
        const sharedBy = typeof payload.shared_by === 'string' ? payload.shared_by.trim().slice(0, 160) : '';
        if (!sharedBy) return json({ message: 'The sending professional is required' }, 422);
        const encoded = new TextEncoder().encode(JSON.stringify(info));
        if (encoded.byteLength > MAX_CLOUD_JSON_BYTES) return json({ message: 'Patient handoff is too large' }, 422);
        const token = randomCardToken();
        const tokenHash = await sha256(token);
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        const encryptedSnapshot = await sealCloudValue(info, patientId);
        const { error } = await admin.from('patient_handoffs').insert({
          token_hash: tokenHash,
          patient_id: patientId,
          created_by: user.id,
          encrypted_snapshot: encryptedSnapshot,
          shared_by_name: sharedBy,
          expires_at: expiresAt,
        });
        if (error) throw error;
        return json({ token, expires_at: expiresAt });
      }
      case 'patient-handoff-resolve': {
        const token = typeof payload.token === 'string' ? payload.token : '';
        if (!CARD_TOKEN_PATTERN.test(token)) return json({ message: 'Patient handoff is invalid or expired' }, 404);
        const tokenHash = await sha256(token);
        const { data, error } = await admin.from('patient_handoffs')
          .select('id,patient_id,encrypted_snapshot,shared_by_name,created_at,expires_at')
          .eq('token_hash', tokenHash)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ message: 'Patient handoff is invalid or expired' }, 404);
        const info = await openCloudValue(data.encrypted_snapshot, data.patient_id);
        const { error: auditError } = await admin.from('patient_handoff_accesses').insert({
          handoff_id: data.id,
          accessed_by: user.id,
        });
        if (auditError) throw auditError;
        return json({
          info,
          shared_by: data.shared_by_name,
          shared_at: data.created_at,
          expires_at: data.expires_at,
        });
      }
      case 'device-key-register': {
        const { data, error } = await admin.from('device_keys').insert({ user_id: user.id, public_key: payload.public_key, label: payload.label ?? null }).select().single();
        if (error) throw error; return json({ ...data, is_active: true, registered_at: data.created_at });
      }
      case 'device-key-revoke': {
        const { error } = await admin.from('device_keys').update({ revoked_at: new Date().toISOString() }).eq('id', payload.id).eq('user_id', user.id);
        if (error) throw error; return json(null);
      }
      case 'professional-patient-public-key': {
        await professional();
        const { data, error } = await admin.from('device_keys').select('public_key').eq('user_id', payload.patient_id).is('revoked_at', null).order('created_at', { ascending: false }).limit(1).single();
        if (error) throw error; return json(data);
      }
      case 'professional-submit-envelope': {
        await professional();
        const { data, error } = await admin.from('encrypted_envelopes').insert({ sender_id: user.id, recipient_id: payload.patient_id, envelope_type: payload.envelope_type, ciphertext: payload.ciphertext, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).select().single();
        if (error) throw error; return json(data);
      }
      case 'professional-track-verification': {
        await professional();
        const { error } = await admin.from('verification_records').upsert({ patient_id: payload.patient_id, professional_id: user.id, envelope_type: payload.envelope_type, item_identifier: payload.item_identifier, verified: payload.verified, verified_at: new Date().toISOString() }, { onConflict: 'patient_id,professional_id,envelope_type,item_identifier' });
        if (error) throw error; return json(null);
      }
      case 'professional-patient-verifications': {
        await professional();
        const { data, error } = await admin.from('verification_records').select('*').eq('patient_id', payload.patient_id).eq('professional_id', user.id);
        if (error) throw error;
        const result = { allergies: [], conditions: [], diagnoses: [], medications: [] } as Record<string, unknown[]>;
        for (const row of data) { const key = `${String(row.envelope_type).split('_')[0]}s`; if (result[key]) result[key].push({ item: row.item_identifier, verified: row.verified, verified_at: row.verified_at }); }
        return json(result);
      }
      case 'registration-matches-list': {
        const { data, error } = await admin.from('registration_matches').select('*').eq('candidate_user_id', user.id).eq('status', 'pending');
        if (error) throw error; return json(data);
      }
      case 'registration-match-decide': {
        const status = payload.decision === 'accept' ? 'approved' : 'denied';
        const { error } = await admin.from('registration_matches').update({ status, decided_at: new Date().toISOString() }).eq('id', payload.id).eq('candidate_user_id', user.id);
        if (error) throw error; return json(null);
      }
      case 'professional-applications-mine': {
        const { data, error } = await admin.from('professional_applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) throw error; return json(data);
      }
      case 'professional-application-get': {
        const { data, error } = await admin.from('professional_applications').select('*').eq('id', payload.id).eq('user_id', user.id).single();
        if (error) throw error; return json(data);
      }
      case 'admin-professional-applications-list': {
        if (!isAdmin(user)) return json({ message: 'Admin access required' }, 403);
        const { data, error } = await admin.from('professional_applications').select('*').eq('status', 'pending_review').order('created_at', { ascending: true }).limit(100);
        if (error) throw error;
        const userIds = [...new Set((data ?? []).map((item) => item.user_id))];
        const { data: profiles } = userIds.length ? await admin.from('profiles').select('id,first_name,middle_name,last_name').in('id', userIds) : { data: [] };
        const names = new Map((profiles ?? []).map((profile) => [profile.id, [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')]));
        return json((data ?? []).map((item) => ({ ...item, applicant_name: names.get(item.user_id) ?? 'Applicant' })));
      }
      case 'admin-professional-application-get': {
        if (!isAdmin(user)) return json({ message: 'Admin access required' }, 403);
        const { data, error } = await admin.from('professional_applications').select('*').eq('id', payload.id).maybeSingle();
        if (error) throw error;
        if (!data) return json({ message: 'Application not found. Refresh the verification queue.' }, 404);
        const evidence = Array.isArray(data.document_paths) ? data.document_paths : [];
        const signedEvidence = await Promise.all(evidence.map(async (entry: unknown) => {
          const item = typeof entry === 'string' ? { kind: 'evidence', path: entry } : entry as { kind?: unknown; path?: unknown };
          if (typeof item.path !== 'string' || !item.path.startsWith(`${data.user_id}/`)) throw new Error('Invalid evidence path');
          const { data: signed, error: signedError } = await admin.storage.from('professional-applications').createSignedUrl(item.path, 300);
          if (signedError) throw signedError;
          return { kind: typeof item.kind === 'string' ? item.kind : 'evidence', url: signed.signedUrl };
        }));
        const { data: profile } = await admin.from('profiles').select('first_name,middle_name,last_name,dob').eq('id', data.user_id).single();
        const storedScreening = data.screening_result && typeof data.screening_result === 'object' ? data.screening_result as Record<string, unknown> : {};
        const legacyText = typeof storedScreening.extracted_text === 'string' ? storedScreening.extracted_text : '';
        const structuredScreening = legacyText ? { ...extractPrcFields(legacyText), ...storedScreening } : storedScreening;
        delete structuredScreening.extracted_text;
        return json({ ...data, screening_result: structuredScreening, applicant_name: [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' '), applicant_dob: profile?.dob ?? null, evidence: signedEvidence });
      }
      case 'professional-application-review': {
        if (!isAdmin(user)) return json({ message: 'Admin access required' }, 403);
        const status = String(payload.status);
        if (!['approved', 'denied'].includes(status)) return json({ message: 'Invalid review status' }, 422);
        const reason = typeof payload.rejection_reason === 'string' ? payload.rejection_reason.trim() : '';
        if (status === 'denied' && !reason) return json({ message: 'A denial reason is required' }, 422);
        const { data: application, error } = await admin.rpc('review_professional_application', { p_application_id: payload.id, p_reviewer_id: user.id, p_decision: status, p_reason: reason });
        if (error) throw error;
        return json(application);
      }
      case 'professional-application-submit': {
        if (!form || form.get('id_type') !== 'ph_prc') return json({ message: 'A Philippine PRC ID is required' }, 422);
        const { data: active } = await admin.from('professional_applications').select('id').eq('user_id', user.id).in('status', ['processing', 'pending_review', 'approved']).maybeSingle();
        if (active) return json({ message: 'You already have an active professional application' }, 409);
        const idPhoto = form.get('id_photo');
        const selfies = form.getAll('selfie_frames[]').filter((value): value is File => value instanceof File);
        const flashes = form.getAll('flash_frames[]').filter((value): value is File => value instanceof File);
        if (!(idPhoto instanceof File) || selfies.length < 1 || flashes.length < 3 || form.get('blink_detected') !== '1') return json({ message: 'Complete the ID and liveness capture before submitting' }, 422);
        const files = [{ kind: 'id_photo', file: idPhoto }, ...selfies.map((file, index) => ({ kind: `selfie_${index + 1}`, file })), ...flashes.map((file, index) => ({ kind: `flash_${index + 1}`, file }))];
        if (files.some(({ file }) => !['image/jpeg', 'image/png'].includes(file.type) || file.size > 4_000_000)) return json({ message: 'Evidence images must be JPEG or PNG and no larger than 4 MB each' }, 422);
        const paths: Array<{ kind: string; path: string }> = [];
        for (const { kind, file } of files) { const path = `${user.id}/${crypto.randomUUID()}-${kind}.jpg`; const { error } = await admin.storage.from('professional-applications').upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; paths.push({ kind, path }); }
        const { data: created, error } = await admin.from('professional_applications').insert({ user_id: user.id, id_type: 'ph_prc', issuing_country: 'PH', document_paths: paths, status: 'processing', screening_status: 'processing' }).select().single();
        if (error) throw error;
        try {
          const screening = await screenPrcId(new Uint8Array(await idPhoto.arrayBuffer()));
          const status = screening.status === 'failed' ? 'auto_rejected' : 'pending_review';
          const { data, error: updateError } = await admin.from('professional_applications').update({ status, screening_status: screening.status, screening_result: screening.result, rejection_reason: screening.reason ?? null, license_number: screening.result.license_number ?? null, updated_at: new Date().toISOString() }).eq('id', created.id).select().single();
          if (updateError) throw updateError;
          return json(data);
        } catch (screeningError) {
          await admin.from('professional_applications').update({ status: 'pending_review', screening_status: 'unavailable', screening_result: { message: 'Automated screening was unavailable' }, updated_at: new Date().toISOString() }).eq('id', created.id);
          console.error('Professional application screening failed', screeningError instanceof Error ? screeningError.message : 'unknown error');
          return json({ ...created, status: 'pending_review', screening_status: 'unavailable' });
        }
      }
      case 'admin-invite': {
        if (!isAdmin(user)) return json({ message: 'Admin access required' }, 403);
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        if (!EMAIL_PATTERN.test(email) || email.length > 254) return json({ message: 'Enter a valid email address' }, 422);
        const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw listError;
        let invited = usersPage.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
        if (!invited) {
          const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: 'mediscanmobile://auth/callback' });
          if (inviteError) throw inviteError;
          invited = data.user;
        }
        if (!invited) throw new Error('Unable to invite admin');
        const { error: roleError } = await admin.auth.admin.updateUserById(invited.id, { app_metadata: { ...invited.app_metadata, role: 'admin' } });
        if (roleError) throw roleError;
        return json({ email, invited: !invited.last_sign_in_at });
      }
      case 'audit-emergency-qr': {
        await professional();
        await admin.from('patient_professional_relationships').upsert({ patient_id: payload.patient_id, professional_id: user.id, active: true, permissions: { emergency: true } }, { onConflict: 'patient_id,professional_id' });
        const { error } = await admin.from('scan_events').insert({ patient_id: payload.patient_id, professional_id: user.id, action: payload.action, context: payload.context ?? null });
        if (error) throw error; return json(null);
      }
      case 'professional-scans-list': {
        await professional();
        const { data, error } = await admin.from('scan_events').select('patient_id,created_at').eq('professional_id', user.id).order('created_at', { ascending: false });
        if (error) throw error;
        const patientIds = [...new Set(data.map((row) => row.patient_id))];
        const { data: profiles, error: profilesError } = patientIds.length ? await admin.from('profiles').select('id,first_name,middle_name,last_name,dob,gender,avatar_path').in('id', patientIds) : { data: [], error: null };
        if (profilesError) throw profilesError;
        const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        const grouped = new Map<string, any>();
        for (const row of data) { const old = grouped.get(row.patient_id); const profile = profileById.get(row.patient_id); if (old) old.scan_count += 1; else grouped.set(row.patient_id, { id: row.patient_id, fullname: [profile?.first_name,profile?.middle_name,profile?.last_name].filter(Boolean).join(' '), avatar: profile?.avatar_path ?? null, age: null, gender: profile?.gender ?? null, dob: profile?.dob ?? null, notes: null, scan_count: 1, last_scanned_at: row.created_at }); }
        const rows = [...grouped.values()];
        return json({ data: rows, meta: { current_page: 1, last_page: 1, per_page: rows.length, total: rows.length }, links: { first: null, last: null, prev: null, next: null } });
      }
      case 'professional-scan-detail': {
        await professional();
        const { data: relationship } = await admin.from('patient_professional_relationships').select('id').eq('patient_id', payload.patient_id).eq('professional_id', user.id).eq('active', true).maybeSingle();
        if (!relationship) return json({ message: 'Patient access not granted' }, 403);
        const { data, error } = await admin.from('profiles').select('*').eq('id', payload.patient_id).single();
        if (error) throw error;
        return json({ id: data.id, full_name: [data.first_name,data.middle_name,data.last_name].filter(Boolean).join(' '), date_of_birth: data.dob, gender: data.gender, phone: data.phone_number ?? '', address: data.address, blood_type: null, religion: null, no_blood_transfusion: false, avatar: data.avatar_path, allergies: [], conditions: [], diagnoses: [], medications: [], emergency_contacts: [] });
      }
      case 'professional-encounter-save': {
        await professional();
        const patientId = typeof payload.patient_id === 'string' && UUID_PATTERN.test(payload.patient_id) ? payload.patient_id : '';
        if (!patientId) return json({ message: 'Invalid patient' }, 422);
        const { error: relationshipError } = await admin.from('patient_professional_relationships').upsert(
          { patient_id: patientId, professional_id: user.id, active: true, permissions: { emergency: true } },
          { onConflict: 'patient_id,professional_id' },
        );
        if (relationshipError) throw relationshipError;
        const rawVitals = Array.isArray(payload.vitals) ? payload.vitals.slice(-100) : [];
        const vitals = rawVitals.map((value) => value as Record<string, unknown>).filter((vital) => VITAL_KINDS.has(String(vital.kind)) && typeof vital.value === 'string' && vital.value.length <= 12).map((vital) => ({ kind: String(vital.kind), value: String(vital.value), unit: String(vital.unit ?? '').slice(0, 20), measuredAt: typeof vital.measuredAt === 'string' ? vital.measuredAt : new Date().toISOString() }));
        if (vitals.length !== rawVitals.length) return json({ message: 'Invalid vital signs' }, 422);
        const { data: profile } = await admin.from('profiles').select('first_name,middle_name,last_name').eq('id', user.id).single();
        const professionalName = [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Verified professional';
        const encounterPayload = { observations: typeof payload.observations === 'string' ? payload.observations.trim().slice(0, 4000) : '', actionsTaken: typeof payload.actions_taken === 'string' ? payload.actions_taken.trim().slice(0, 4000) : '', vitals: vitals.map((vital) => ({ ...vital, recordedBy: professionalName, verifiedBy: { userId: user.id, name: professionalName } })), recordedAt: typeof payload.recorded_at === 'string' ? payload.recorded_at : new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedBy: { userId: user.id, name: professionalName } };
        const encryptedPayload = await sealCloudValue(encounterPayload, patientId);
        const encounterId = typeof payload.id === 'string' && UUID_PATTERN.test(payload.id) ? payload.id : null;
        const operation = encounterId
          ? admin.from('professional_encounters').update({ encrypted_payload: encryptedPayload, updated_at: new Date().toISOString() }).eq('id', encounterId).eq('patient_id', patientId).eq('professional_id', user.id).select().single()
          : admin.from('professional_encounters').insert({ patient_id: patientId, professional_id: user.id, encrypted_payload: encryptedPayload }).select().single();
        const { data: saved, error } = await operation;
        if (error) throw error;
        await admin.from('notifications').insert({ user_id: patientId, type: 'professional_encounter_updated', payload: { encounter_id: saved.id, professional_id: user.id } });
        return json({ id: saved.id, patient_id: patientId, professional_id: user.id, ...encounterPayload });
      }
      case 'professional-encounters-list': {
        const requestedPatientId = typeof payload.patient_id === 'string' ? payload.patient_id : user.id;
        if (!UUID_PATTERN.test(requestedPatientId)) return json({ message: 'Invalid patient' }, 422);
        if (requestedPatientId !== user.id) {
          await professional();
          const { data: relationship } = await admin.from('patient_professional_relationships').select('id').eq('patient_id', requestedPatientId).eq('professional_id', user.id).eq('active', true).maybeSingle();
          if (!relationship) return json({ message: 'Encounter access required' }, 403);
        }
        let query = admin.from('professional_encounters').select('*').eq('patient_id', requestedPatientId).order('updated_at', { ascending: false }).limit(100);
        if (requestedPatientId !== user.id) query = query.eq('professional_id', user.id);
        const { data, error } = await query;
        if (error) throw error;
        const professionalIds = [...new Set((data ?? []).map((row) => row.professional_id))];
        const { data: profiles } = professionalIds.length ? await admin.from('profiles').select('id,first_name,middle_name,last_name').in('id', professionalIds) : { data: [] };
        const names = new Map((profiles ?? []).map((row) => [row.id, [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')]));
        const decoded = [];
        for (const row of data ?? []) {
          try { decoded.push({ id: row.id, patient_id: row.patient_id, professional_id: row.professional_id, professional_name: names.get(row.professional_id) ?? 'Verified professional', ...(await openCloudValue(row.encrypted_payload, row.patient_id) as Record<string, unknown>) }); } catch { /* Never expose damaged clinical data. */ }
        }
        return json(decoded);
      }
      case 'professional-scan-notes-get': {
        await professional();
        const { data, error } = await admin.from('scan_notes').select('*').eq('patient_id', payload.patient_id).eq('professional_id', user.id).maybeSingle();
        if (error) throw error; return json(data);
      }
      case 'professional-scan-notes-save': {
        await professional();
        const { data, error } = await admin.from('scan_notes').upsert({ patient_id: payload.patient_id, professional_id: user.id, notes: payload.notes, updated_at: new Date().toISOString() }, { onConflict: 'patient_id,professional_id' }).select().single();
        if (error) throw error; return json(data);
      }
      case 'account-retrieval-status': {
        const { data, error } = await admin.from('account_retrieval_requests').select('status').eq('id', payload.id).eq('user_id', user.id).single();
        if (error) throw error; return json(data);
      }
      case 'professional-permissions-update': {
        const { data, error } = await admin.from('patient_professional_relationships').update({ permissions: payload.permissions }).eq('patient_id', user.id).eq('professional_id', payload.professional_id).select().single();
        if (error) throw error;
        await admin.from('notifications').insert({ user_id: payload.professional_id, type: 'professional_permissions_changed', payload: { patient_id: user.id, permissions: payload.permissions } });
        return json(data);
      }
      case 'my-scan-activity': {
        const { data, error, count } = await admin.from('scan_events').select('id,created_at,professional_id', { count: 'exact' }).eq('patient_id', user.id).range(0, Number(payload.per_page ?? 20) - 1);
        if (error) throw error;
        const professionalIds = [...new Set(data.map((row) => row.professional_id).filter(Boolean))];
        const { data: profiles } = professionalIds.length ? await admin.from('profiles').select('id,first_name,last_name').in('id', professionalIds) : { data: [] };
        const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        return json({ data: data.map((r) => { const profile = profileById.get(r.professional_id); return { id: r.id, scanner_fullname: [profile?.first_name, profile?.last_name].filter(Boolean).join(' '), scanned_at: r.created_at }; }), meta: { current_page: 1, last_page: 1, per_page: Number(payload.per_page ?? 20), total: count ?? 0 }, links: { first: null, last: null, prev: null, next: null } });
      }
      default: return json({ message: `Unknown action: ${action}` }, 404);
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'The request could not be completed';
    return json({ message }, message.includes('professional') ? 403 : 400);
  }
});
