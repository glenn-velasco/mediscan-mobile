import { forgotPassword } from '@/api/endpoints/account';
import { supabase, throwSupabaseError } from '@/api/supabase';

jest.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
  },
  throwSupabaseError: jest.fn((error) => {
    throw error;
  }),
}));

const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;
const mockThrowSupabaseError = throwSupabaseError as unknown as jest.Mock;

describe('forgotPassword', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockResetPasswordForEmail.mockReset();
    mockThrowSupabaseError.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completes when Supabase accepts the reset request', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await expect(forgotPassword('patient@example.com')).resolves.toBeNull();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('patient@example.com', {
      redirectTo: 'mediscanmobile://auth/callback',
    });
  });

  it('stops waiting after 15 seconds and gives retry guidance', async () => {
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));

    const result = expect(forgotPassword('patient@example.com')).rejects.toThrow(
      'This is taking longer than expected. Check your email before trying again.',
    );
    await jest.advanceTimersByTimeAsync(15_000);

    await result;
  });
});
