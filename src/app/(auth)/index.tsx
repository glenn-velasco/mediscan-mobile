import { useState } from 'react';
import { Image, View } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { PasswordField } from '@/components/form/password-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useLogin } from '@/features/auth/useLogin';
import { useApiError } from '@/api/use-api-error';
import { loginSchema } from '@/lib/validation/login-schema';

export default function LoginScreen() {
  const { mutateAsync: login, isPending } = useLogin();
  const { message, fieldErrors, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    clearErrors();
    setValidationErrors({});
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setValidationErrors(errors);
      return;
    }
    try {
      await login({ email, password });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout>
      <View className="mb-10 items-center">
        <Image
          source={require('@/assets/images/mediscan-logo.png')}
          resizeMode="contain"
          style={{ width: 220, height: 91, marginBottom: 12 }}
          accessibilityLabel="MediScan"
        />
        <ThemedText type="body" color="mutedForeground" className="mt-2 text-center">
          When you can&apos;t explain, your QR will.
        </ThemedText>
      </View>

      <FormError message={message} />

      <TextField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={validationErrors.email || fieldErrors.email} />
      <PasswordField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} error={validationErrors.password || fieldErrors.password} />

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
