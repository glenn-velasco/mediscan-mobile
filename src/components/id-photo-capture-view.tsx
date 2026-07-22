import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useTheme } from '@/hooks/use-theme';

export type CapturedPhoto = { uri: string; name: string; type: string };

/**
 * Still-photo capture for the professional ID document — no landmark tracking needed here (unlike
 * the liveness selfie), so this stays on expo-camera rather than vision-camera, mirroring
 * qr-scanner-view.tsx's permission-gated CameraView pattern.
 */
export function IdPhotoCaptureView({ onCaptured }: { onCaptured: (photo: CapturedPhoto) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        setPreviewUri(photo.uri);
        onCaptured({ uri: photo.uri, name: 'id-photo.jpg', type: 'image/jpeg' });
      }
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured]);

  const retake = useCallback(() => setPreviewUri(null), []);

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View className="items-center gap-4 py-8">
        <ThemedText color="mutedForeground" className="text-center">
          Camera access is needed to photograph your ID.
        </ThemedText>
        <PrimaryButton label="Grant camera access" onPress={() => void requestPermission()} />
      </View>
    );
  }

  if (previewUri) {
    return (
      <View className="gap-3">
        <Image source={{ uri: previewUri }} className="aspect-[3/2] w-full rounded-lg" resizeMode="cover" />
        <PrimaryButton label="Retake" variant="ghost" onPress={retake} />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="aspect-[3/2] w-full overflow-hidden rounded-lg bg-black">
        <CameraView ref={cameraRef} style={{ width: '100%', height: '100%' }} facing="back" />
        <View pointerEvents="none" className="absolute inset-4 rounded-lg border-2 border-white/80" />
      </View>
      <Pressable
        onPress={handleCapture}
        disabled={capturing}
        className="items-center justify-center rounded-xl py-4 active:scale-[0.98]"
        style={{ backgroundColor: theme.primary, opacity: capturing ? 0.5 : 1 }}
        accessibilityRole="button"
      >
        <ThemedText type="label" style={{ color: theme.primaryForeground }}>
          {capturing ? 'Capturing…' : 'Capture ID photo'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
