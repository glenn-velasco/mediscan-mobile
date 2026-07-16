import { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useLogin } from '@/features/auth/useLogin';
import { useApiError } from '@/api/use-api-error';

export default function LoginScreen() {
  const { mutateAsync: login, isPending } = useLogin();
  const { message, fieldErrors, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    clearErrors();
    try {
      await login({ email, password });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout>
      <View className="mb-10 items-center">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: '#0d7377' }}>
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <View className="h-4 w-4 rounded-full" style={{ backgroundColor: '#ffffff' }} />
          </View>
        </View>
        <ThemedText type="title" className="text-center">
          MediScan
        </ThemedText>
        <ThemedText type="body" color="mutedForeground" className="mt-2 text-center">
          When you can&apos;t explain, your QR will.
        </ThemedText>
      </View>

      <FormError message={message} />

      <TextField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={fieldErrors.email} />
      <TextField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry error={fieldErrors.password} />

      <PrimaryButton label="Log in" loading={isPending} onPress={onSubmit} className="mt-2" />

      <View className="mt-6 items-center gap-3">
        <Link href="/register">
          <ThemedText type="link">Don&apos;t have an account? Register</ThemedText>
        </Link>
        <Link href="/forgot-password">
          <ThemedText type="link">Forgot your password?</ThemedText>
        </Link>
      </View>
    </AuthLayout>
  );
}
