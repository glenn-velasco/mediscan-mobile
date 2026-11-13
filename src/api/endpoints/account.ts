import { Platform } from 'react-native';
import { supabase, throwSupabaseError } from '@/api/supabase';

const PASSWORD_RESET_TIMEOUT_MS = 15_000;

function getAuthCallbackUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return 'mediscanmobile://auth/callback';
}

export async function updateEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throwSupabaseError(error);
  return null;
}

export async function updatePassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) throwSupabaseError(userError ?? new Error('Authentication required'));
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: userData.user.email, password: payload.current_password });
  if (reauthError) throwSupabaseError(reauthError);
  const { error } = await supabase.auth.updateUser({ password: payload.password });
  if (error) throwSupabaseError(error);
  return null;
}

export async function sendEmailVerificationNotification() {
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  const { error } = await supabase.auth.resend({ type: 'signup', email: data.user.email });
  if (error) throwSupabaseError(error);
  return null;
}

export async function forgotPassword(email: string) {
  const request = supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthCallbackUrl() });
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('This is taking longer than expected. Check your email before trying again.')),
      PASSWORD_RESET_TIMEOUT_MS,
    );
  });
  const { error } = await Promise.race([request, timeout]).finally(() => clearTimeout(timeoutId));
  if (error) throwSupabaseError(error);
  return null;
}

export async function resetPassword(payload: { password: string }) {
  const { error } = await supabase.auth.updateUser({ password: payload.password });
  if (error) throwSupabaseError(error);

  // A recovery link creates a temporary authenticated session. End that session after the
  // password is changed so it cannot fall through into the app without the normal login and
  // patient-data hydration flow. Local scope is intentional: resetting a password here should
  // not unexpectedly sign the user out of their other trusted devices.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  // Supabase clears local storage and emits SIGNED_OUT before its best-effort server revoke.
  // A revoke error must not misreport the already-completed password change as a failure.
  if (signOutError) console.warn('[Auth] Recovery session ended locally; server revoke was deferred');
  return null;
}
