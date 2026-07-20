import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { IdPhotoCaptureView, type CapturedPhoto } from '@/components/id-photo-capture-view';
import { LivenessCaptureView, type LivenessCaptureResult } from '@/components/liveness-capture-view';
import { CoeUploadView, type CapturedFile } from '@/components/coe-upload-view';
import { useApiError } from '@/api/use-api-error';
import { submitProfessionalApplication } from '@/services/professional-application.service';

type Step = 'id-photo' | 'liveness' | 'coe' | 'submitting';

const STEP_LABEL: Record<Step, string> = {
  'id-photo': 'Step 1 of 3 — Photograph your ID',
  liveness: 'Step 2 of 3 — Verify it\'s you',
  coe: 'Step 3 of 3 — Certificate of Employment',
  submitting: 'Submitting…',
};

export default function CreateProfessionalApplicationScreen() {
  const router = useRouter();
  const { message, setError, clearErrors } = useApiError();
  const [step, setStep] = useState<Step>('id-photo');
  const [idPhoto, setIdPhoto] = useState<CapturedPhoto | null>(null);
  const [liveness, setLiveness] = useState<LivenessCaptureResult | null>(null);
  const [coe, setCoe] = useState<CapturedFile | null>(null);

  const handleIdPhoto = useCallback((photo: CapturedPhoto) => {
    setIdPhoto(photo);
    setStep('liveness');
  }, []);

  const handleLiveness = useCallback((result: LivenessCaptureResult) => {
    setLiveness(result);
    setStep('coe');
  }, []);

  const submit = useCallback(
    async (file: CapturedFile) => {
      if (!idPhoto || !liveness) return;
      clearErrors();
      setCoe(file);
      setStep('submitting');
      try {
        const application = await submitProfessionalApplication({
          idType: 'ph_prc',
          idPhoto,
          selfieFrames: liveness.selfieFrames,
          flashFrames: liveness.flashFrames,
          flashColors: liveness.flashColors,
          coe: file,
        });
        router.replace({ pathname: '/professional-application/[id]', params: { id: String(application.id) } });
      } catch (err) {
        setError(err);
        setStep('coe');
      }
    },
    [idPhoto, liveness, clearErrors, setError, router],
  );

  return (
    <AppLayout>
      <View className="mb-4 gap-1">
        <ThemedText type="overline">{STEP_LABEL[step]}</ThemedText>
        <ThemedText type="subtitle">Get verified</ThemedText>
      </View>

      <FormError message={message} />

      {step === 'id-photo' && <IdPhotoCaptureView onCaptured={handleIdPhoto} />}
      {step === 'liveness' && <LivenessCaptureView onCaptured={handleLiveness} onReset={() => setLiveness(null)} />}
      {(step === 'coe' || step === 'submitting') && (
        <View className="gap-4">
          <CoeUploadView onPicked={(file) => void submit(file)} />
          {step === 'submitting' && <PrimaryButton label="Submitting…" loading disabled />}
        </View>
      )}
    </AppLayout>
  );
}
