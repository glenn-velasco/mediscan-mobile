import { Suspense, lazy, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { DateField } from '@/components/form/date-field';
import { IdPhotoCaptureView, type CapturedPhoto } from '@/components/id-photo-capture-view';
import type { LivenessCaptureResult } from '@/components/liveness-capture-view';
import { useApiError } from '@/api/use-api-error';
import { submitProfessionalApplication } from '@/services/professional-application.service';
import { dateOfBirthSchema } from '@/lib/validation/date-of-birth-schema';

const LivenessCaptureView = lazy(() =>
  import('@/components/liveness-capture-view').then((m) => ({ default: m.LivenessCaptureView })),
);

type Step = 'id-photo' | 'liveness' | 'date-of-birth' | 'submitting';

const STEP_LABEL: Record<Step, string> = {
  'id-photo': 'Step 1 of 3 — Photograph your ID',
  liveness: 'Step 2 of 3 — Verify it\'s you',
  'date-of-birth': 'Step 3 of 3 — Date of birth',
  submitting: 'Submitting…',
};

export default function CreateProfessionalApplicationScreen() {
  const router = useRouter();
  const { message, setError, clearErrors } = useApiError();
  const [step, setStep] = useState<Step>('id-photo');
  const idPhotoRef = useRef<CapturedPhoto | null>(null);
  const livenessRef = useRef<LivenessCaptureResult | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleIdPhoto = (photo: CapturedPhoto) => {
    idPhotoRef.current = photo;
    setStep('liveness');
  };

  const handleLiveness = (result: LivenessCaptureResult) => {
    livenessRef.current = result;
    setStep('date-of-birth');
  };

  const submit = async () => {
    const idPhoto = idPhotoRef.current;
    const liveness = livenessRef.current;
    if (!idPhoto || !liveness) return;

    const result = dateOfBirthSchema.safeParse(dateOfBirth);
    if (!result.success) {
      setFieldErrors({ date_of_birth: result.error.issues[0]?.message ?? 'Invalid date of birth' });
      return;
    }
    setFieldErrors({});

    clearErrors();
    setStep('submitting');
    try {
      const application = await submitProfessionalApplication({
        idType: 'ph_prc',
        idPhoto,
        selfieFrames: liveness.selfieFrames,
        flashFrames: liveness.flashFrames,
        flashColors: liveness.flashColors,
        blinkDetected: liveness.blinkDetected,
        dateOfBirth: result.data,
      });
      router.replace({ pathname: '/professional-application/[id]', params: { id: String(application.id) } });
    } catch (err) {
      setError(err);
      setStep('date-of-birth');
    }
  };

  return (
    <AppLayout>
      <View className="mb-4 gap-1">
        <ThemedText type="overline">{STEP_LABEL[step]}</ThemedText>
        <ThemedText type="subtitle">Get verified</ThemedText>
      </View>

      <FormError message={message} />

      {step === 'id-photo' && <IdPhotoCaptureView onCaptured={handleIdPhoto} />}
      {step === 'liveness' && (
        <Suspense fallback={<View className="flex-1 items-center justify-center py-12"><ActivityIndicator size="large" /></View>}>
          <LivenessCaptureView onCaptured={handleLiveness} onReset={() => (livenessRef.current = null)} />
        </Suspense>
      )}
      {(step === 'date-of-birth' || step === 'submitting') && (
        <View className="gap-4">
          <DateField
            label="Date of birth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            maximumDate={new Date()}
            error={fieldErrors.date_of_birth}
          />
          <PrimaryButton
            label={step === 'submitting' ? 'Submitting…' : 'Submit'}
            loading={step === 'submitting'}
            disabled={step === 'submitting'}
            onPress={() => void submit()}
          />
        </View>
      )}
    </AppLayout>
  );
}
