import { useState } from 'react';
import { Alert, View } from 'react-native';
import { getErrorMessage } from '@/api/errors';
import { TextField } from '@/components/form/text-field';
import { AppLayout } from '@/components/layouts/app-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useInviteAdmin } from '@/features/admin-verification/useAdminVerification';

export default function InviteAdminScreen() {
  const [email, setEmail] = useState(''); const invite = useInviteAdmin();
  const submit = () => invite.mutate(email.trim(), { onSuccess: (result) => { Alert.alert('Admin access granted', result.invited ? 'An invitation email was sent.' : 'The existing account is now an admin. They should sign in again.'); setEmail(''); }, onError: (error) => Alert.alert('Invitation failed', getErrorMessage(error)) });
  return <AppLayout><View className="gap-4"><ThemedText color="mutedForeground">Existing MediScan accounts receive the admin role immediately. New addresses receive a Supabase invitation.</ThemedText><TextField label="Admin email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><PrimaryButton label="Invite admin" loading={invite.isPending} disabled={invite.isPending || !email.trim()} onPress={submit} /></View></AppLayout>;
}
