import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthLayout } from '@/components/layouts/auth-layout';
import { ThemedText } from '@/components/themed-text';
import { parseAuthCallbackUrl } from '@/auth/auth-callback';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    const { accessToken, code, refreshToken, tokenHash, type } = parseAuthCallbackUrl(url);

    void (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }
      router.replace(type === 'recovery' ? '/(auth)/reset-password' : '/email-verified');
    })();
  }, [url]);

  return <AuthLayout><View className="items-center gap-4"><ActivityIndicator /><ThemedText>Completing authentication…</ThemedText></View></AuthLayout>;
}
