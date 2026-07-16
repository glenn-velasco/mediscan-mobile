import {
  errorFromEnvelope,
  UnauthenticatedError,
  AccountDeactivatedError,
  ValidationError,
  ApiError,
  isApiError,
  getErrorStatus,
  getErrorMessage,
  getFieldErrors,
} from '@/api/errors';

describe('errorFromEnvelope', () => {
  it('classifies a 401 as UnauthenticatedError', () => {
    const error = errorFromEnvelope({ status: 401, message: 'Unauthenticated.', errors: null });
    expect(error).toBeInstanceOf(UnauthenticatedError);
  });

  it('classifies a 403 with a deactivated message as AccountDeactivatedError', () => {
    const error = errorFromEnvelope({ status: 403, message: 'Your account has been deactivated.', errors: null });
    expect(error).toBeInstanceOf(AccountDeactivatedError);
  });

  it('does not classify an unrelated 403 as AccountDeactivatedError', () => {
    const error = errorFromEnvelope({ status: 403, message: 'Forbidden.', errors: null });
    expect(error).not.toBeInstanceOf(AccountDeactivatedError);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('classifies a 422 as ValidationError and preserves the field errors', () => {
    const error = errorFromEnvelope({
      status: 422,
      message: 'The email has already been taken.',
      errors: { email: ['The email has already been taken.'] },
    });
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.errors).toEqual({ email: ['The email has already been taken.'] });
  });

  it('falls back to a generic ApiError for other statuses', () => {
    const error = errorFromEnvelope({ status: 500, message: 'Server error.', errors: null });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(ValidationError);
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    const error = new ApiError({ status: 400, message: 'Bad request.', errors: null });
    expect(isApiError(error)).toBe(true);
  });

  it('returns true for subclass instances', () => {
    const error = new ValidationError({ status: 422, message: 'Invalid.', errors: null });
    expect(isApiError(error)).toBe(true);
  });

  it('returns false for plain errors', () => {
    expect(isApiError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isApiError('string')).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe('getErrorStatus', () => {
  it('returns the status from an ApiError', () => {
    const error = new ApiError({ status: 403, message: 'Forbidden.', errors: null });
    expect(getErrorStatus(error)).toBe(403);
  });

  it('returns null for non-ApiError', () => {
    expect(getErrorStatus(new Error('plain'))).toBe(null);
  });
});

describe('getErrorMessage', () => {
  it('extracts message from an ApiError', () => {
    const error = new ApiError({ status: 400, message: 'Bad request.', errors: null });
    expect(getErrorMessage(error)).toBe('Bad request.');
  });

  it('extracts message from a plain Error', () => {
    expect(getErrorMessage(new Error('plain error'))).toBe('plain error');
  });

  it('returns fallback for non-Error values', () => {
    expect(getErrorMessage('some string')).toBe('Something went wrong. Please try again.');
  });

  it('uses custom fallback', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('getFieldErrors', () => {
  it('returns empty object for non-ApiError', () => {
    expect(getFieldErrors(new Error('plain'))).toEqual({});
  });

  it('returns empty object when errors is null', () => {
    const error = new ApiError({ status: 400, message: 'Bad request.', errors: null });
    expect(getFieldErrors(error)).toEqual({});
  });

  it('extracts first message per field', () => {
    const error = new ApiError({
      status: 422,
      message: 'Validation failed.',
      errors: {
        email: ['The email has already been taken.', 'Another email error.'],
        password: ['The password must be at least 8 characters.'],
      },
    });
    expect(getFieldErrors(error)).toEqual({
      email: 'The email has already been taken.',
      password: 'The password must be at least 8 characters.',
    });
  });

  it('remaps keys when fieldMap is provided', () => {
    const error = new ApiError({
      status: 422,
      message: 'Validation failed.',
      errors: {
        dob: ['The date of birth is required.'],
        phone_number: ['The phone number is invalid.'],
        email: ['The email is required.'],
      },
    });
    expect(getFieldErrors(error, { dob: 'date_of_birth', phone_number: 'phone' })).toEqual({
      date_of_birth: 'The date of birth is required.',
      phone: 'The phone number is invalid.',
      email: 'The email is required.',
    });
  });

  it('skips fields with empty message arrays', () => {
    const error = new ApiError({
      status: 422,
      message: 'Validation failed.',
      errors: {
        email: [],
        password: ['Required.'],
      },
    });
    expect(getFieldErrors(error)).toEqual({ password: 'Required.' });
  });
});
