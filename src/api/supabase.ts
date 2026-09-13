import type { PostgrestError } from '@supabase/supabase-js';

import { NetworkError, UnauthenticatedError, ValidationError } from '@/api/errors';
import { supabase } from '@/lib/supabase';

export { supabase };

export function throwSupabaseError(error: PostgrestError | Error | null): never {
  if (!error) throw new Error('Unknown Supabase error');
  const isExpiredJwt = /(?:invalid JWT|token is expired|jwt expired)/i.test(error.message);
  const status = ('code' in error && error.code === 'PGRST301') || isExpiredJwt ? 401 : undefined;
  if (status === 401) throw new UnauthenticatedError({ status: 401, message: error.message });
  if ('code' in error && ['23505', '23503', '23514', 'PGRST116'].includes(error.code)) {
    throw new ValidationError({ status: 422, message: error.message, errors: null });
  }
  if ('code' in error) throw Object.assign(new Error(error.message), { status: 400, code: error.code });
  throw new NetworkError(error);
}

export async function requireAuthUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new UnauthenticatedError({ status: 401, message: 'Authentication required' });
  return data.user.id;
}

export async function invokeFunction<T>(name: string, body?: BodyInit | Record<string, unknown>): Promise<T> {
  let requestBody: BodyInit | Record<string, unknown>;
  if (body instanceof FormData) {
    body.set('action', name);
    requestBody = body;
  } else {
    requestBody = { action: name, payload: body ?? {} };
  }
  const invoke = () => supabase.functions.invoke<T>('mediscan-privileged', { body: requestBody });
  let result = await invoke();

  // A foregrounded mobile app can resume with an access token that expired while
  // it was suspended. Refresh and retry once; the user should not have to sign out.
  const response = 'context' in (result.error ?? {}) ? (result.error as { context?: unknown }).context : null;
  if (result.error && response instanceof Response && response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) result = await invoke();
  }

  if (result.error) {
    const context = 'context' in result.error ? (result.error as { context?: unknown }).context : null;
    if (context instanceof Response) {
      const envelope = await context.clone().json().catch(() => null) as { message?: unknown } | null;
      const message = typeof envelope?.message === 'string' ? envelope.message : result.error.message;
      throw Object.assign(new Error(message), { status: context.status });
    }
    throwSupabaseError(result.error);
  }
  return result.data as T;
}
