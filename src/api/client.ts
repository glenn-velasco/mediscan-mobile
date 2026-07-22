import { Config } from '@/constants/config';
import { getCachedToken } from '@/auth/token-storage';
import { errorFromEnvelope, NetworkError, UnauthenticatedError } from '@/api/errors';
import type { ApiEnvelope, PaginationMeta, PaginationLinks } from '@/api/types';

type UnauthenticatedHandler = () => void;
let onUnauthenticated: UnauthenticatedHandler | null = null;

export function registerUnauthenticatedHandler(handler: UnauthenticatedHandler): void {
  onUnauthenticated = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (auth) {
    const token = getCachedToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('[api] No cached token available — request will be unauthenticated');
    }
  }

  let response: Response;
  try {
    response = await fetch(`${Config.apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    console.error(`[api] ${method} ${path} → network error`, cause);
    throw new NetworkError(cause);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json();
  } catch (cause) {
    console.error(`[api] ${method} ${path} → failed to parse response`, cause);
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    console.warn(`[api] ${method} ${path} → ${response.status}`, envelope.message);
    const error = errorFromEnvelope({ ...envelope, status: envelope.status ?? response.status });
    if (error instanceof UnauthenticatedError) onUnauthenticated?.();
    throw error;
  }

  return envelope.data as T;
}

export async function requestPaginated<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta; links: PaginationLinks }> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (auth) {
    const token = getCachedToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${Config.apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    const e = envelope as { status?: number; message?: string; errors?: Record<string, string[]> | null };
    const err = errorFromEnvelope({
      status: e.status ?? response.status,
      message: e.message ?? 'Error',
      data: undefined,
      errors: e.errors ?? null,
    });
    if (err instanceof UnauthenticatedError) onUnauthenticated?.();
    throw err;
  }

  const pe = envelope as { data: T[]; meta: PaginationMeta; links: PaginationLinks };
  return { data: pe.data, meta: pe.meta, links: pe.links };
}

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getCachedToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('[api] No cached token available — request will be unauthenticated');
  }

  let response: Response;
  try {
    // No Content-Type header here — fetch derives the multipart boundary itself from the
    // FormData body; setting it manually drops the boundary and the server can't parse the parts.
    response = await fetch(`${Config.apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (cause) {
    console.error(`[api] POST ${path} → network error`, cause);
    throw new NetworkError(cause);
  }

  const rawBody = await response.text();
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(rawBody);
  } catch (cause) {
    console.error(`[api] POST ${path} → failed to parse response`, {
      status: response.status,
      statusText: response.statusText,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.slice(0, 500),
      cause,
    });
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    console.warn(`[api] POST ${path} → ${response.status}`, envelope.message);
    const error = errorFromEnvelope({ ...envelope, status: envelope.status ?? response.status });
    if (error instanceof UnauthenticatedError) onUnauthenticated?.();
    throw error;
  }

  return envelope.data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
