import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useResetPassword } from '@/features/auth/useResetPassword';
import { useApiError } from '@/api/use-api-error';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const { mutateAsync: resetPassword, isPending } = useResetPassword();
  const { message, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const onSubmit = async () => {
    if (!params.token) {
      setError(new Error('Missing reset token. Please use the link from your email.'));
      return;
    }
    clearErrors();
    try {
      await resetPassword({
        token: params.token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      router.replace('/');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout>
      <ThemedText className="mb-8 text-center text-2xl font-semibold">Choose a new password</ThemedText>

      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextField label="Confirm new password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry />

      <FormError message={message} />

      <PrimaryButton label="Reset password" loading={isPending} onPress={onSubmit} className="mt-2" />

      <Link href="/" className="mt-6 self-center">
        <ThemedText type="link">Back to log in</ThemedText>
      </Link>
    </AuthLayout>
  );
}
