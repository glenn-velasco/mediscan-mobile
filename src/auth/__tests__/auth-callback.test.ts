import { parseAuthCallbackUrl } from '@/auth/auth-callback';

describe('parseAuthCallbackUrl', () => {
  it('reads a native Supabase recovery session from the URL fragment', () => {
    expect(parseAuthCallbackUrl(
      'mediscanmobile://auth/callback#access_token=access&refresh_token=refresh&type=recovery',
    )).toEqual({
      accessToken: 'access',
      code: null,
      refreshToken: 'refresh',
      tokenHash: null,
      type: 'recovery',
    });
  });

  it('reads a web Supabase recovery session from the URL fragment', () => {
    expect(parseAuthCallbackUrl(
      'https://app.mediscan.cloud/auth/callback#access_token=access&refresh_token=refresh&type=recovery',
    )).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      type: 'recovery',
    });
  });

  it('reads PKCE codes and regular email verification types from the query', () => {
    expect(parseAuthCallbackUrl(
      'https://app.mediscan.cloud/auth/callback?code=pkce-code&type=signup',
    )).toMatchObject({ code: 'pkce-code', type: 'signup' });
  });
});
