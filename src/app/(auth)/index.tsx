import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { PasswordField } from '@/components/form/password-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useLogin } from '@/features/auth/useLogin';
import { useApiError } from '@/api/use-api-error';
import { loginSchema } from '@/lib/validation/login-schema';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
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
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      const detail = err instanceof Error ? err.message : '';
      if (code === 'invalid_credentials' || /invalid login credentials/i.test(detail)) {
        setError(new Error('Incorrect email or password. Please try again.'));
      } else if (/email not confirmed/i.test(detail)) {
        setError(new Error('Please confirm your email address before logging in.'));
      } else {
        setError(err);
      }
    }
  };

  return (
    <AuthLayout>
      <View className="mb-10 items-center">
        <Image
          source={require('@/assets/images/mediscan-logo.png')}
          contentFit="contain"
          style={{ width: 220, height: 91, marginBottom: 12 }}
          accessibilityLabel="MediScan"
        />
        <ThemedText type="body" color="mutedForeground" className="mt-2 text-center">
          One consistent emergency scan when every second matters.
        </ThemedText>
      </View>

      <FormError message={message} />

      <TextField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={validationErrors.email || fieldErrors.email} />
      <PasswordField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} error={validationErrors.password || fieldErrors.password} />

      <PrimaryButton label="Log in" loading={isPending} onPress={onSubmit} className="mt-2" />

      <ThemedText type="small" color="mutedForeground" className="my-2 text-center">or</ThemedText>
      <Link href="/responder-scan" asChild>
        <PrimaryButton
          label="Scan emergency QR"
          variant="outline"
          leftIcon={<Ionicons name="qr-code-outline" size={22} color={theme.primary} />}
          style={{ borderColor: theme.primary, backgroundColor: theme.card }}
          accessibilityHint="No account is required"
        />
      </Link>
      <ThemedText type="small" color="mutedForeground" className="mt-1 text-center">No account needed for an emergency scan</ThemedText>

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
