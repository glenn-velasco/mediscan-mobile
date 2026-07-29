import { apiClient } from '@/api/client';
import type { LoginPayload, LoginResponseData, RegisterPayload, RegisterResponseData, User } from '@/api/types';

export function login(payload: LoginPayload) {
  return apiClient.post<LoginResponseData>('api/v1/login', payload, { auth: false });
}

export function register(payload: RegisterPayload) {
  return apiClient.post<RegisterResponseData>('api/v1/register', payload, { auth: false });
}

export function logout() {
  return apiClient.post<null>('api/v1/logout');
}

export function me() {
  return apiClient.get<{ user: User }>('api/v1/me');
}

/**
 * Request a fresh personal-access-token whose abilities reflect the user's
 * current permissions. Called after a professional application is approved so
 * the token picks up the `verified professional` ability that was missing
 * when the token was originally issued at login/registration.
 */
export function refreshToken() {
  return apiClient.post<{ token: string }>('api/v1/auth/refresh-token');
}
