import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { Card } from '@/components/card';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { AppLayout } from '@/components/layouts/app-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useAdminProfessionalApplication, useReviewProfessionalApplication } from '@/features/admin-verification/useAdminVerification';
import { useTheme } from '@/hooks/use-theme';
import { useImagePreview } from '@/hooks/use-image-preview';
import { formatProfessionalVerificationRejection, PROFESSIONAL_VERIFICATION_REJECTIONS } from '@/constants/professional-verification-rejection';

export default function AdminVerificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const theme = useTheme();
  const validId = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const application = useAdminProfessionalApplication(validId ? id : undefined); const review = useReviewProfessionalApplication(); const [selectedReasonId, setSelectedReasonId] = useState(''); const [reasonNotes, setReasonNotes] = useState('');
  const preview = useImagePreview();
  const decide = (status: 'approved' | 'denied') => {
    const selectedReason = PROFESSIONAL_VERIFICATION_REJECTIONS.find((item) => item.id === selectedReasonId);
    if (!id || (status === 'denied' && !selectedReason)) { Alert.alert('Reason required', 'Choose the verification issue so the applicant receives the correct retry steps.'); return; }
    const reason = selectedReason ? formatProfessionalVerificationRejection(selectedReason, reasonNotes) : undefined;
    Alert.alert(status === 'approved' ? 'Approve professional?' : 'Deny application?', status === 'approved' ? 'This grants verified professional access.' : 'The applicant will receive the selected reason and instructions for reapplying.', [{ text: 'Cancel', style: 'cancel' }, { text: status === 'approved' ? 'Approve' : 'Deny', style: status === 'denied' ? 'destructive' : 'default', onPress: () => review.mutate({ id, status, reason }, { onSuccess: () => router.replace('/admin-verification' as Href), onError: (error) => Alert.alert('Review failed', getErrorMessage(error)) }) }]);
  };
  if (!validId) return <AppLayout><Card className="gap-3"><ThemedText color="destructive">Invalid application link.</ThemedText><PrimaryButton label="Back to verification queue" onPress={() => router.replace('/admin-verification' as Href)} /></Card></AppLayout>;
  if (application.isLoading) return <AppLayout><ActivityIndicator color={theme.primary} /></AppLayout>;
  if (!application.data) return <AppLayout><Card className="gap-3"><ThemedText color="destructive">{application.isError ? getErrorMessage(application.error) : 'Application not found.'}</ThemedText>{application.isError ? <PrimaryButton label="Try again" loading={application.isRefetching} disabled={application.isRefetching} onPress={() => void application.refetch()} /> : null}</Card></AppLayout>;
  const data = application.data;
  const evidence = data.evidence ?? [];
  const previewIndex = preview.uri ? evidence.findIndex((item) => item.url === preview.uri) : -1;
  const selectedRejection = PROFESSIONAL_VERIFICATION_REJECTIONS.find((item) => item.id === selectedReasonId);
  return <AppLayout><><ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
    <Card className="gap-2"><ThemedText type="subtitle">{data.screening_result?.full_name ?? data.full_name_on_id ?? 'Not extracted'}</ThemedText><ThemedText>ID type: {data.screening_result?.id_type ?? data.id_type.replaceAll('_', ' ').toUpperCase()}</ThemedText><ThemedText>Registration number: {data.screening_result?.registration_number ?? data.license_number ?? 'Not extracted'}</ThemedText><ThemedText>Registration date: {data.screening_result?.registration_date ?? 'Not extracted'}</ThemedText></Card>
    <View className="gap-3"><ThemedText type="subtitle">Identity evidence</ThemedText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{evidence.map((item) => <Pressable key={item.kind} accessibilityRole="button" accessibilityLabel={`Preview ${item.kind.replaceAll('_', ' ')}`} onPress={() => preview.open(item.url)} style={{ width: '47%', gap: 6 }}><View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.muted }}><Image source={{ uri: item.url }} contentFit="cover" style={{ width: '100%', height: '100%' }} /></View><ThemedText type="smallBold">{item.kind.replaceAll('_', ' ')}</ThemedText></Pressable>)}</View></View>
    <Card className="gap-3"><ThemedText type="subtitle">Decision</ThemedText><ThemedText color="mutedForeground">Compare the PRC portrait with the selfie frames and independently check the PRC license before approving.</ThemedText><SelectField placeholder="Reason for denial" options={PROFESSIONAL_VERIFICATION_REJECTIONS.map((item) => item.id)} value={selectedReasonId || undefined} onChange={(value) => setSelectedReasonId(value ?? '')} getLabel={(value) => PROFESSIONAL_VERIFICATION_REJECTIONS.find((item) => item.id === value)?.title ?? value} floatingLabelBackground={theme.card} />{selectedRejection ? <View style={{ gap: 6, borderRadius: 12, backgroundColor: theme.muted, padding: 12 }}><ThemedText type="smallBold">Instructions sent to the applicant</ThemedText><ThemedText type="small">{selectedRejection.explanation}</ThemedText>{selectedRejection.steps.map((step, index) => <ThemedText key={step} type="small" color="mutedForeground">{index + 1}. {step}</ThemedText>)}</View> : null}<TextField label="Additional notes (optional)" value={reasonNotes} onChangeText={setReasonNotes} multiline numberOfLines={3} /><PrimaryButton label="Approve professional" loading={review.isPending} disabled={review.isPending} onPress={() => decide('approved')} /><PrimaryButton label="Deny application" variant="danger" disabled={review.isPending} onPress={() => decide('denied')} /></Card>
  </ScrollView><Modal visible={preview.visible} transparent animationType="fade" onRequestClose={preview.close}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' }}>{preview.uri ? <Image source={{ uri: preview.uri }} contentFit="contain" style={{ width: '94%', height: '78%' }} /> : null}<Pressable accessibilityRole="button" accessibilityLabel="Close evidence preview" onPress={preview.close} style={{ position: 'absolute', top: 52, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={26} color="#fff" /></Pressable>{evidence.length > 1 ? <View style={{ position: 'absolute', bottom: 46, flexDirection: 'row', gap: 72 }}><Pressable accessibilityRole="button" accessibilityLabel="Previous evidence" disabled={previewIndex <= 0} onPress={() => preview.open(evidence[previewIndex - 1].url)}><Ionicons name="chevron-back-circle" size={48} color={previewIndex > 0 ? '#fff' : '#666'} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next evidence" disabled={previewIndex < 0 || previewIndex >= evidence.length - 1} onPress={() => preview.open(evidence[previewIndex + 1].url)}><Ionicons name="chevron-forward-circle" size={48} color={previewIndex >= 0 && previewIndex < evidence.length - 1 ? '#fff' : '#666'} /></Pressable></View> : null}</View></Modal></></AppLayout>;
}
