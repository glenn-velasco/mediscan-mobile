import type { LoginPayload, LoginResponseData, MedicalInformationAddress, RegisterPayload, RegisterResponseData, User } from '@/api/types';
import { supabase, throwSupabaseError } from '@/api/supabase';

type ProfileRow = Omit<User, 'email' | 'email_verified_at' | 'fullname' | 'age' | 'roles' | 'permissions' | 'medical_information'> & {
  is_professional: boolean;
  professional_verified_at: string | null;
};

function normalizeAddress(value: unknown): MedicalInformationAddress | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return { street: value, unit: null, city: null, province: null, postal_code: null, country: null };
  }
  if (typeof value !== 'object') return null;
  const address = value as Record<string, unknown>;
  const text = (key: string) => typeof address[key] === 'string' ? address[key] as string : null;
  return {
    street: text('street') ?? text('formatted'),
    unit: text('unit'),
    city: text('city'),
    province: text('province'),
    postal_code: text('postal_code'),
    country: text('country'),
  };
}

async function currentUser(): Promise<User> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throwSupabaseError(authError ?? new Error('Authentication required'));
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
  if (error) throwSupabaseError(error);
  const row = profile as ProfileRow;
  const roles = row.is_professional ? ['professional'] : ['patient'];
  const rawAddress = row.address as unknown;
  const medicalAddress = normalizeAddress(rawAddress);
  const address = typeof rawAddress === 'string'
    ? rawAddress
    : rawAddress && typeof rawAddress === 'object' && 'formatted' in rawAddress
      ? String((rawAddress as { formatted?: unknown }).formatted ?? '')
      : '';
  return {
    ...row,
    id: authData.user.id,
    email: authData.user.email ?? '',
    email_verified_at: authData.user.email_confirmed_at ?? null,
    fullname: [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' '),
    age: row.dob ? Math.max(0, new Date().getFullYear() - new Date(row.dob).getFullYear()) : null,
    address,
    roles,
    permissions: row.professional_verified_at ? ['verified professional'] : [],
    // This uses the profile row already fetched above, so an older account can
    // initialize its encrypted local medical record without another request.
    // Once SQLite has a record, the UI continues to read that local copy.
    medical_information: {
      id: 1,
      email: authData.user.email ?? '',
      full_name: [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' '),
      date_of_birth: row.dob ?? null,
      gender: row.gender ?? null,
      phone: row.phone_number ?? '',
      phone_country_code: row.phone_country_code ?? null,
      address: medicalAddress,
      blood_type: null,
      religion: null,
      no_blood_transfusion: false,
      allergies: [],
      conditions: [],
      diagnoses: [],
      medications: [],
      emergency_contacts: [],
    },
  };
}

export function login(payload: LoginPayload) {
  return supabase.auth.signInWithPassword({ email: payload.email, password: payload.password }).then(async ({ data, error }) => {
    if (error || !data.session) throwSupabaseError(error ?? new Error('No session returned'));
    return { token: data.session.access_token, user: await currentUser() } satisfies LoginResponseData;
  });
}

export function register(payload: RegisterPayload) {
  return supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo: 'mediscanmobile://auth/callback',
      data: { first_name: payload.first_name, middle_name: payload.middle_name ?? null, last_name: payload.last_name, suffix: payload.suffix ?? null, dob: payload.dob, gender: payload.gender, address: payload.address, phone_number: payload.phone_number, phone_country_code: payload.phone_country_code },
    },
  }).then(async ({ data, error }) => {
    if (error) throwSupabaseError(error);
    if (!data.session) return { pending: true } satisfies RegisterResponseData;
    return { pending: false, token: data.session.access_token, user: await currentUser() } satisfies RegisterResponseData;
  });
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throwSupabaseError(error);
  return null;
}

export async function me() {
  return { user: await currentUser() };
}

/**
 * Request a fresh personal-access-token whose abilities reflect the user's
 * current permissions. Called after a professional application is approved so
 * the token picks up the `verified professional` ability that was missing
 * when the token was originally issued at login/registration.
 */
export async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throwSupabaseError(error ?? new Error('No session returned'));
  return { token: data.session.access_token };
}
