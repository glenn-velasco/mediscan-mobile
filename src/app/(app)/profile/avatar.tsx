import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useAvatarStore } from '@/stores/avatar-store';

type Mode = 'choose' | 'camera';

export default function AvatarCaptureScreen() {
  const router = useRouter();
  const saveLocal = useAvatarStore((s) => s.saveLocal);
  const setPendingUpload = useAvatarStore((s) => s.setPendingUpload);
  const medicalInformationId = useAvatarStore((s) => s.medicalInformationId);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [mode, setMode] = useState<Mode>('choose');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleUsePhoto = async () => {
    if (!previewUri) return;

    if (!medicalInformationId) {
      console.warn('[avatar-screen] no medicalInformationId, cannot upload');
      Alert.alert('Not ready', 'Your profile is still loading. Please try again.');
      return;
    }

    console.log('[avatar-screen] saving photo locally...', { previewUri, medicalInformationId });
    setSaving(true);
    // react-doctor-disable-next-line react-hooks-js/todo
    try {
      const localUri = await saveLocal(previewUri);
      console.log('[avatar-screen] saved locally:', localUri);

      setPendingUpload({ localUri, medicalInformationId });
      console.log('[avatar-screen] pending upload set, navigating back');

      router.back();
    } catch (e) {
      console.warn('[avatar-screen] save failed:', e);
      Alert.alert('Error', 'Failed to save photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setMode('camera');
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setPreviewUri(result.assets[0].uri);
  };

  const takeSelfie = async () => {
    if (!cameraRef.current) return;
    const captured = await cameraRef.current.takePictureAsync({ quality: 0.85 });
    if (!captured) return;
    setPreviewUri(captured.uri);
  };

  const retake = () => {
    setPreviewUri(null);
    setMode('choose');
  };

  return (
    <AppLayout>
      <View className="mb-4 gap-1">
        <ThemedText type="overline">Update photo</ThemedText>
        <ThemedText type="subtitle">Choose a profile photo</ThemedText>
      </View>

      {!previewUri && mode === 'choose' ? (
        <View className="gap-3">
          <PrimaryButton label="Take a selfie" onPress={() => void openCamera()} />
          <PrimaryButton label="Choose from gallery" variant="ghost" onPress={() => void openGallery()} />
        </View>
      ) : null}

      {!previewUri && mode === 'camera' ? (
        <View className="gap-3">
          <View className="aspect-square w-full overflow-hidden rounded-lg bg-black">
            <CameraView ref={cameraRef} style={{ width: '100%', height: '100%' }} facing="front" />
          </View>
          <PrimaryButton label="Capture" onPress={() => void takeSelfie()} />
          <PrimaryButton label="Cancel" variant="ghost" onPress={() => setMode('choose')} />
        </View>
      ) : null}

      {previewUri ? (
        <View className="gap-3">
          <Image source={{ uri: previewUri }} className="aspect-square w-full rounded-lg" contentFit="cover" />
          <PrimaryButton label="Use photo" loading={saving} onPress={() => void handleUsePhoto()} />
          <PrimaryButton label="Choose a different photo" variant="ghost" disabled={saving} onPress={retake} />
        </View>
      ) : null}
    </AppLayout>
  );
}
