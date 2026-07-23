import { useCallback, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { useApiError } from '@/api/use-api-error';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useUpdateMedicalInformationAvatar } from '@/features/medical-information/useMedicalInformationAvatar';
import type { SelectedAvatarPhoto } from '@/services/medical-information-avatar.service';

type Mode = 'choose' | 'camera' | 'preview';

export default function AvatarCaptureScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { message, setError, clearErrors } = useApiError();
  const { data: medicalInformation } = useMedicalInformation();
  const { mutateAsync: submitPhoto, isPending: uploading } = useUpdateMedicalInformationAvatar();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [mode, setMode] = useState<Mode>('choose');
  const [photo, setPhoto] = useState<SelectedAvatarPhoto | null>(null);

  const openCamera = useCallback(async () => {
    clearErrors();
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError(new Error('Camera access is needed to take a selfie.'));
        return;
      }
    }
    setMode('camera');
  }, [permission, requestPermission, clearErrors, setError]);

  const openGallery = useCallback(async () => {
    clearErrors();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' });
    setMode('preview');
  }, [clearErrors]);

  const takeSelfie = useCallback(async () => {
    if (!cameraRef.current) return;
    const captured = await cameraRef.current.takePictureAsync({ quality: 0.85 });
    if (!captured) return;
    setPhoto({ uri: captured.uri, name: 'avatar.jpg', type: 'image/jpeg' });
    setMode('preview');
  }, []);

  const retake = useCallback(() => {
    setPhoto(null);
    setMode('choose');
  }, []);

  const usePhoto = useCallback(async () => {
    if (!photo) return;
    if (!medicalInformation?.server_id) {
      setError(new Error('Your medical information hasn\'t finished syncing yet — please try again shortly.'));
      return;
    }

    clearErrors();
    try {
      await submitPhoto({ medicalInformationId: medicalInformation.server_id, photo });
      router.back();
    } catch (err) {
      setError(err);
    }
  }, [photo, medicalInformation?.server_id, submitPhoto, clearErrors, setError, router]);

  return (
    <AppLayout>
      <View className="mb-4 gap-1">
        <ThemedText type="overline">Update photo</ThemedText>
        <ThemedText type="subtitle">Choose a profile photo</ThemedText>
      </View>

      {message ? (
        <View className="mb-4 rounded-md p-3" style={{ backgroundColor: theme.destructive + '26' }}>
          <ThemedText type="small" style={{ color: theme.destructive }}>
            {message}
          </ThemedText>
        </View>
      ) : null}

      {mode === 'choose' ? (
        <View className="gap-3">
          <PrimaryButton label="Take a selfie" onPress={() => void openCamera()} />
          <PrimaryButton label="Choose from gallery" variant="ghost" onPress={() => void openGallery()} />
        </View>
      ) : null}

      {mode === 'camera' ? (
        <View className="gap-3">
          <View className="aspect-square w-full overflow-hidden rounded-lg bg-black">
            <CameraView ref={cameraRef} style={{ width: '100%', height: '100%' }} facing="front" />
          </View>
          <PrimaryButton label="Capture" onPress={() => void takeSelfie()} />
          <PrimaryButton label="Cancel" variant="ghost" onPress={() => setMode('choose')} />
        </View>
      ) : null}

      {mode === 'preview' && photo ? (
        <View className="gap-3">
          <Image source={{ uri: photo.uri }} className="aspect-square w-full rounded-lg" resizeMode="cover" />
          <PrimaryButton label="Use photo" loading={uploading} onPress={() => void usePhoto()} />
          <PrimaryButton label="Choose a different photo" variant="ghost" disabled={uploading} onPress={retake} />
        </View>
      ) : null}
    </AppLayout>
  );
}
