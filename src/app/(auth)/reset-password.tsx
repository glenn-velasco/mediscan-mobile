import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { PasswordField } from '@/components/form/password-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useResetPassword } from '@/features/auth/useResetPassword';
import { useApiError } from '@/api/use-api-error';
import { passwordWithConfirmation } from '@/lib/validation/password-schema';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const { mutateAsync: resetPassword, isPending } = useResetPassword();
  const { message, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    if (!params.token) {
      setError(new Error('Missing reset token. Please use the link from your email.'));
      return;
    }
    clearErrors();
    setValidationErrors({});
    const result = passwordWithConfirmation.safeParse({ password, passwordConfirmation });
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
      <PasswordField label="New password" value={password} onChangeText={setPassword} error={validationErrors.password} />
      <PasswordField label="Confirm new password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} error={validationErrors.passwordConfirmation} />

      <FormError message={message} />

      <PrimaryButton label="Reset password" loading={isPending} onPress={onSubmit} className="mt-2" />

      <Link href="/" className="mt-6 self-center">
        <ThemedText type="link">Back to log in</ThemedText>
      </Link>
    </AuthLayout>
  );
}
