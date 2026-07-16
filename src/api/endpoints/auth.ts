import { apiClient } from '@/api/client';
import type { LoginPayload, LoginResponseData, RegisterPayload, User } from '@/api/types';

export function login(payload: LoginPayload) {
  return apiClient.post<LoginResponseData>('api/v1/login', payload, { auth: false });
}

export function register(payload: RegisterPayload) {
  return apiClient.post<LoginResponseData>('api/v1/register', payload, { auth: false });
}

export function logout() {
  return apiClient.post<null>('api/v1/logout');
}

export function me() {
  return apiClient.get<{ user: User }>('api/v1/me');
}
