import { useCallback, useState } from 'react';
import { getErrorMessage, getFieldErrors, getErrorStatus } from '@/api/errors';

type UseApiErrorOptions = {
  fieldMap?: Record<string, string>;
};

export function useApiError(options?: UseApiErrorOptions) {
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<number | null>(null);

  const setError = useCallback(
    (err: unknown) => {
      setMessage(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err, options?.fieldMap));
      setStatus(getErrorStatus(err));
    },
    [options?.fieldMap],
  );

  const clearErrors = useCallback(() => {
    setMessage(null);
    setFieldErrors({});
    setStatus(null);
  }, []);

  return { message, fieldErrors, status, setError, clearErrors };
}
