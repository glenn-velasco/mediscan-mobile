import {
  ValidationError,
  ApiError,
  NetworkError,
  getErrorMessage,
  getFieldErrors,
  getErrorStatus,
} from '@/api/errors';
import type { ApiEnvelope } from '@/api/types';

function makeValidationEnvelope(errors: Record<string, string[]>, message?: string): ApiEnvelope<unknown> {
  return { status: 422, message: message ?? 'Validation failed', errors };
}

function makeServerErrorEnvelope(): ApiEnvelope<unknown> {
  return { status: 500, message: 'Internal server error' };
}

describe('login error scenarios', () => {
  it('credential failure: message and field error on email', () => {
    const envelope = makeValidationEnvelope({
      email: ['These credentials do not match our records.'],
    });
    const err = new ValidationError(envelope);

    // Login screen would show this as the FormError message
    expect(getErrorMessage(err)).toBe('Validation failed');

    // Login screen would show this on the email TextField
    const fieldErrors = getFieldErrors(err);
    expect(fieldErrors).toEqual({ email: 'These credentials do not match our records.' });
    expect(fieldErrors.password).toBeUndefined();

    expect(getErrorStatus(err)).toBe(422);
  });

  it('missing email and password: both fields show errors', () => {
    const envelope = makeValidationEnvelope({
      email: ['The email field is required.'],
      password: ['The password field is required.'],
    });
    const err = new ValidationError(envelope);

    const fieldErrors = getFieldErrors(err);
    expect(fieldErrors.email).toBe('The email field is required.');
    expect(fieldErrors.password).toBe('The password field is required.');
  });

  it('invalid email format: error on email field only', () => {
    const envelope = makeValidationEnvelope({
      email: ['The email must be a valid email address.'],
    });
    const err = new ValidationError(envelope);

    const fieldErrors = getFieldErrors(err);
    expect(fieldErrors.email).toBe('The email must be a valid email address.');
    expect(fieldErrors.password).toBeUndefined();
  });

  it('missing password only: error on password field only', () => {
    const envelope = makeValidationEnvelope({
      password: ['The password field is required.'],
    });
    const err = new ValidationError(envelope);

    const fieldErrors = getFieldErrors(err);
    expect(fieldErrors.password).toBe('The password field is required.');
    expect(fieldErrors.email).toBeUndefined();
  });

  it('deactivated account: error under email, 403 status', () => {
    const envelope: ApiEnvelope<unknown> = {
      status: 403,
      message: 'Your account has been deactivated.',
      errors: { email: ['Your account has been deactivated.'] },
    };
    const err = new ApiError(envelope);

    expect(getErrorMessage(err)).toBe('Your account has been deactivated.');
    expect(getFieldErrors(err)).toEqual({ email: 'Your account has been deactivated.' });
    expect(getErrorStatus(err)).toBe(403);
  });

  it('server error (500): message only, no field errors', () => {
    const err = new ApiError(makeServerErrorEnvelope());

    expect(getErrorMessage(err)).toBe('Internal server error');
    expect(getFieldErrors(err)).toEqual({});
    expect(getErrorStatus(err)).toBe(500);
  });

  it('network failure: fallback message, no field errors', () => {
    const err = new NetworkError('Offline');

    expect(getErrorMessage(err)).toBe('Network request failed');
    expect(getFieldErrors(err)).toEqual({});
    expect(getErrorStatus(err)).toBeNull();
  });

  it('first error message used when multiple per field', () => {
    const envelope = makeValidationEnvelope({
      email: ['The email is required.', 'The email must be valid.'],
    });
    const err = new ValidationError(envelope);

    const fieldErrors = getFieldErrors(err);
    expect(fieldErrors.email).toBe('The email is required.');
  });

  it('field errors are empty when API returns null errors', () => {
    const envelope: ApiEnvelope<unknown> = {
      status: 422,
      message: 'Something went wrong',
      errors: null,
    };
    const err = new ValidationError(envelope);

    expect(getFieldErrors(err)).toEqual({});
  });

  it('non-Error throwable returns fallback', () => {
    expect(getErrorMessage('just a string')).toBe('Something went wrong. Please try again.');
    expect(getFieldErrors('just a string')).toEqual({});
    expect(getErrorStatus('just a string')).toBeNull();
  });
});
