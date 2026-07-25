import { useState } from 'react';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useForgotPassword } from '@/features/auth/useForgotPassword';
import { useTheme } from '@/hooks/use-theme';
import { useApiError } from '@/api/use-api-error';
import { emailSchema } from '@/lib/validation/email-schema';

export default function ForgotPasswordScreen() {
  const { mutateAsync: forgotPassword, isPending } = useForgotPassword();
  const theme = useTheme();
  const { message, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    clearErrors();
    setSuccessMessage(null);
    setValidationErrors({});
    const result = emailSchema.safeParse({ email });
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
      await forgotPassword(email);
      setSuccessMessage('If that email is registered, a reset link is on its way.');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout>
      <ThemedText className="mb-8 text-center text-2xl font-semibold">Reset your password</ThemedText>

      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={validationErrors.email} />

      {successMessage ? <ThemedText className="mb-2" style={{ color: theme.success }}>{successMessage}</ThemedText> : null}
      <FormError message={message} />

      <PrimaryButton label="Send reset link" loading={isPending} onPress={onSubmit} className="mt-2" />

      <Link href="/" className="mt-6 self-center">
        <ThemedText type="link">Back to log in</ThemedText>
      </Link>
    </AuthLayout>
  );
}
