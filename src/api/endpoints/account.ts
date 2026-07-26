import { apiClient } from '@/api/client';

export function updateEmail(email: string) {
  return apiClient.put<null>('api/v1/email', { email });
}

export function updatePassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  return apiClient.put<null>('api/v1/password', payload);
}

export function sendEmailVerificationNotification() {
  return apiClient.post<null>('api/v1/email/verification-notification');
}

export function forgotPassword(email: string) {
  return apiClient.post<null>('api/v1/forgot-password', { email }, { auth: false });
}

export function resetPassword(payload: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  return apiClient.post<null>('api/v1/reset-password', payload, { auth: false });
}
