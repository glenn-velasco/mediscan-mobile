import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_SNAPSHOT_BYTES = 24_000;

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

    let snapshot: { snapshot_payload: string; snapshot_generated_at: string; published_at: string } | null = null;
    if (CARD_TOKEN_PATTERN.test(token)) {
      const tokenHash = await sha256(token);
      const { data } = await admin.from('dynamic_emergency_cards')
        .select('snapshot_payload,snapshot_generated_at,published_at')
        .eq('token_hash', tokenHash).is('revoked_at', null).not('snapshot_payload', 'is', null).maybeSingle();
      snapshot = data;
    }
    await admin.from('dynamic_emergency_card_lookup_attempts').insert({
      requester_hash: requesterHash,
      token_prefix_hash: tokenPrefixHash,
      succeeded: Boolean(snapshot),
    });
    if (!snapshot) return json({ message: 'Emergency card unavailable' }, 404);
    return json({
      qr_payload: snapshot.snapshot_payload,
      snapshot_generated_at: snapshot.snapshot_generated_at,
      published_at: snapshot.published_at,
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
      case 'professional-application-review': {
        if (user.app_metadata?.role !== 'admin') return json({ message: 'Admin access required' }, 403);
        const status = String(payload.status);
        if (!['approved', 'denied'].includes(status)) return json({ message: 'Invalid review status' }, 422);
        const { data: application, error } = await admin.from('professional_applications').update({ status, rejection_reason: payload.rejection_reason ?? null, role_granted: status === 'approved' ? payload.role_granted ?? 'professional' : null, updated_at: new Date().toISOString() }).eq('id', payload.id).select().single();
        if (error) throw error;
        if (status === 'approved') await admin.from('profiles').update({ is_professional: true, professional_verified_at: new Date().toISOString() }).eq('id', application.user_id);
        await admin.from('notifications').insert({ user_id: application.user_id, type: 'professional_application_status', payload: { application_id: application.id, status } });
        return json(application);
      }
      case 'professional-application-submit': {
        const fields = Object.fromEntries([...Object.entries(payload)].filter(([, value]) => typeof value === 'string' && value !== action));
        const paths: string[] = [];
        if (form) for (const [name, value] of form.entries()) if (value instanceof File) { const path = `${user.id}/${crypto.randomUUID()}-${value.name}`; const { error } = await admin.storage.from('professional-applications').upload(path, value); if (error) throw error; paths.push(path); }
        const { data, error } = await admin.from('professional_applications').insert({ ...fields, user_id: user.id, document_paths: paths, status: 'pending_review' }).select().single();
        if (error) throw error; return json(data);
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
    const message = error instanceof Error ? error.message : String(error);
    return json({ message }, message.includes('professional') ? 403 : 400);
  }
});
