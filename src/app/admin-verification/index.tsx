import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useAuth } from '@/auth/useAuth';
import { Card } from '@/components/card';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { useAdminProfessionalApplications } from '@/features/admin-verification/useAdminVerification';
import { useTheme } from '@/hooks/use-theme';

export default function AdminVerificationQueueScreen() {
  const { user } = useAuth(); const router = useRouter(); const theme = useTheme();
  const isAdmin = user?.permissions.includes('admin') ?? false;
  const query = useAdminProfessionalApplications();
  useEffect(() => { if (user && !isAdmin) router.replace('/account'); }, [isAdmin, router, user]);
  if (!isAdmin) return null;
  return <AppLayout><ScrollView refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
    <View className="mb-2 flex-row items-center justify-between"><View><ThemedText type="screenTitle">Review queue</ThemedText><ThemedText color="mutedForeground">Oldest applications appear first.</ThemedText></View><Link href="/admin-verification/invite" asChild><Pressable accessibilityRole="button" className="p-3"><Ionicons name="person-add" size={22} color={theme.primary} /></Pressable></Link></View>
    {query.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
    {query.isError ? <Card><ThemedText color="destructive">Unable to load the verification queue.</ThemedText></Card> : null}
    {query.data?.length === 0 ? <Card><ThemedText>No applications are waiting for review.</ThemedText></Card> : null}
    {query.data?.map((application) => <Link key={String(application.id)} href={{ pathname: '/admin-verification/[id]', params: { id: String(application.id) } }} asChild><Pressable><Card className="gap-2"><View className="flex-row items-center justify-between"><ThemedText className="font-semibold">{application.applicant_name ?? 'Applicant'}</ThemedText><Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /></View><ThemedText type="small" color="mutedForeground">Submitted {new Date(application.created_at).toLocaleString()}</ThemedText><ThemedText type="small">OCR: {application.screening_status === 'passed' ? 'Passed' : application.screening_status === 'unavailable' ? 'Unavailable — inspect manually' : application.screening_status ?? 'Not run'}</ThemedText></Card></Pressable></Link>)}
  </ScrollView></AppLayout>;
}
