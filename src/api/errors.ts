import type { ApiEnvelope } from '@/api/types';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;

  constructor(envelope: ApiEnvelope<unknown>) {
    super(envelope.message);
    this.name = 'ApiError';
    this.status = envelope.status;
    this.errors = envelope.errors ?? null;
  }
}

export class ValidationError extends ApiError {
  constructor(envelope: ApiEnvelope<unknown>) {
    super(envelope);
    this.name = 'ValidationError';
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(envelope: ApiEnvelope<unknown>) {
    super(envelope);
    this.name = 'UnauthenticatedError';
  }
}

export class AccountDeactivatedError extends ApiError {
  constructor(envelope: ApiEnvelope<unknown>) {
    super(envelope);
    this.name = 'AccountDeactivatedError';
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function errorFromEnvelope(envelope: ApiEnvelope<unknown>): ApiError {
  if (envelope.status === 401) return new UnauthenticatedError(envelope);
  if (envelope.status === 403 && /deactivated/i.test(envelope.message)) {
    return new AccountDeactivatedError(envelope);
  }
  if (envelope.status === 422) return new ValidationError(envelope);
  return new ApiError(envelope);
}

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getErrorStatus(err: unknown): number | null {
  return err instanceof ApiError ? err.status : null;
}

export function getErrorMessage(err: unknown, fallback = DEFAULT_FALLBACK): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function getFieldErrors(
  err: unknown,
  fieldMap?: Record<string, string>,
): Record<string, string> {
  if (!(err instanceof ApiError) || !err.errors) return {};

  const mapped: Record<string, string> = {};
  for (const [key, messages] of Object.entries(err.errors)) {
    if (messages.length > 0) {
      const mappedKey = fieldMap?.[key] ?? key;
      mapped[mappedKey] = messages[0];
    }
  }
  return mapped;
}
