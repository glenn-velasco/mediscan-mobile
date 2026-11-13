import { forgotPassword, resetPassword } from '@/api/endpoints/account';
import { supabase, throwSupabaseError } from '@/api/supabase';

jest.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
    },
  },
  throwSupabaseError: jest.fn((error) => {
    throw error;
  }),
}));

const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
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

describe('resetPassword', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
    mockThrowSupabaseError.mockClear();
  });

  it('updates the password and ends only the recovery session', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    await expect(resetPassword({ password: 'New-password-123!' })).resolves.toBeNull();

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'New-password-123!' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not sign out when the password update fails', async () => {
    const error = new Error('expired recovery session');
    mockUpdateUser.mockResolvedValue({ error });

    await expect(resetPassword({ password: 'New-password-123!' })).rejects.toThrow(error);

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockThrowSupabaseError).toHaveBeenCalledWith(error);
  });

  it('reports success when the recovery session was cleared locally but server revoke failed', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: new Error('network unavailable') });

    await expect(resetPassword({ password: 'New-password-123!' })).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[Auth] Recovery session ended locally; server revoke was deferred');
    warn.mockRestore();
  });
});
