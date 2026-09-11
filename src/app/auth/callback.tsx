import type { EmailOtpType } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthLayout } from '@/components/layouts/auth-layout';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    const parsed = Linking.parse(url);
    const params = parsed.queryParams ?? {};
    const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : null;
    const type = typeof params.type === 'string' ? params.type as EmailOtpType : null;
    const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
    const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
    const code = typeof params.code === 'string' ? params.code : null;

    void (async () => {
      if (code) await supabase.auth.exchangeCodeForSession(code);
      else if (tokenHash && type) await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      else if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      router.replace(type === 'recovery' ? '/(auth)/reset-password' : '/email-verified');
    })();
  }, [url]);

  return <AuthLayout><View className="items-center gap-4"><ActivityIndicator /><ThemedText>Completing authentication…</ThemedText></View></AuthLayout>;
}
