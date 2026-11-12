import type { EmailOtpType } from '@supabase/supabase-js';

export type AuthCallbackParams = {
  accessToken: string | null;
  code: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: EmailOtpType | null;
};

function readValue(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value && value.length > 0 ? value : null;
}

/**
 * Supabase's implicit auth flow returns the session in the URL fragment, while
 * PKCE and token-hash flows use query parameters. Read both so Expo Router gets
 * the same callback data on web and through the native custom scheme.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const hashIndex = url.indexOf('#');
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = urlWithoutHash.indexOf('?');
  const query = queryIndex >= 0 ? urlWithoutHash.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);

  // Fragment values take precedence because Supabase places the authoritative
  // session and recovery type there for its implicit flow.
  for (const [key, value] of new URLSearchParams(hash)) params.set(key, value);

  return {
    accessToken: readValue(params, 'access_token'),
    code: readValue(params, 'code'),
    refreshToken: readValue(params, 'refresh_token'),
    tokenHash: readValue(params, 'token_hash'),
    type: readValue(params, 'type') as EmailOtpType | null,
  };
}
