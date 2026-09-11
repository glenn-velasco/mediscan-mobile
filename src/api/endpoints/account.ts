import { supabase, throwSupabaseError } from '@/api/supabase';

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
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'mediscanmobile://auth/callback' });
  if (error) throwSupabaseError(error);
  return null;
}

export async function resetPassword(payload: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  const { error } = await supabase.auth.updateUser({ password: payload.password });
  if (error) throwSupabaseError(error);
  return null;
}
