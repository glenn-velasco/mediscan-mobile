import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';
import { ThemedText } from '@/components/themed-text';
import { field, sheet } from '@/components/form/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAvatarStore } from '@/stores/avatar-store';

export type AvatarPreviewSheetHandle = { present: () => void; dismiss: () => void };

type Mode = 'view' | 'camera' | 'preview';

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const AvatarPreviewSheet = forwardRef<AvatarPreviewSheetHandle, { name: string }>(function AvatarPreviewSheet(
  { name },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const cameraRef = useRef<CameraView>(null);
  const theme = useTheme();

  const localUri = useAvatarStore((s) => s.localUri);
  const serverUrl = useAvatarStore((s) => s.serverUrl);
  const saveLocal = useAvatarStore((s) => s.saveLocal);
  const setPendingUpload = useAvatarStore((s) => s.setPendingUpload);
  const medicalInformationId = useAvatarStore((s) => s.medicalInformationId);
  const clearAvatar = useAvatarStore((s) => s.clear);

  const [mode, setMode] = useState<Mode>('view');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const imageUri = localUri ?? serverUrl;
  const hasImage = !!imageUri && !imageError;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageError(false);
  }, [imageUri]);

  useImperativeHandle(ref, () => ({
    present: () => {
      setMode('view');
      setPreviewUri(null);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const initials =
    name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setPreviewUri(result.assets[0].uri);
    setMode('preview');
  };

  const handleCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setMode('camera');
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const captured = await cameraRef.current.takePictureAsync({ quality: 0.85 });
    if (!captured) return;
    setPreviewUri(captured.uri);
    setMode('preview');
  };

  const handleUsePhoto = async () => {
    if (!previewUri || !medicalInformationId) return;

    setSaving(true);
    // react-doctor-disable-next-line react-hooks-js/todo
    try {
      const localUri = await saveLocal(previewUri);
      setPendingUpload({ localUri, medicalInformationId });
      setMode('view');
      sheetRef.current?.dismiss();
    } catch (e) {
      console.warn('[avatar-sheet] save failed:', e);
      Alert.alert('Error', 'Failed to save photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          clearAvatar();
          setMode('view');
          sheetRef.current?.dismiss();
        },
      },
    ]);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
      handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
      backdropComponent={renderBackdrop}
      onDismiss={() => {
        setMode('view');
        setPreviewUri(null);
      }}
    >
      <BottomSheetView className="items-center gap-4 px-6 pb-10 pt-4">

        {/* VIEW MODE: avatar preview + action buttons */}
        {mode === 'view' && (
          <>
            <View style={{ width: 160, height: 160, borderRadius: 80, overflow: 'hidden', backgroundColor: theme.accent }}>
              {hasImage ? (
                <Image source={{ uri: imageUri }} style={{ width: 160, height: 160 }} contentFit="cover" transition={200} cachePolicy="memory-disk" onError={() => setImageError(true)} />
              ) : (
                <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: theme.accentForeground, fontSize: 48, fontWeight: '600' }}>{initials}</Text>
                </View>
              )}
            </View>

            <ThemedText type="heading">{name}</ThemedText>

            <View className="w-full gap-2">
              <ActionButton label="Take a selfie" onPress={() => void handleCamera()} theme={theme} />
              <ActionButton label="Choose from gallery" onPress={() => void handleGallery()} theme={theme} variant="ghost" />
              {hasImage && (
                <ActionButton label="Remove photo" onPress={handleRemove} theme={theme} variant="destructive" />
              )}
            </View>
          </>
        )}

        {/* CAMERA MODE */}
        {mode === 'camera' && (
          <>
            <View style={{ width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
              <CameraView ref={cameraRef} style={{ width: '100%', height: '100%' }} facing="front" />
            </View>
            <View className="w-full gap-2">
              <ActionButton label="Capture" onPress={() => void handleCapture()} theme={theme} />
              <ActionButton label="Cancel" onPress={() => setMode('view')} theme={theme} variant="ghost" />
            </View>
          </>
        )}

        {/* PREVIEW MODE */}
        {mode === 'preview' && previewUri && (
          <>
            <View style={{ width: 160, height: 160, borderRadius: 80, overflow: 'hidden' }}>
              <Image source={{ uri: previewUri }} style={{ width: 160, height: 160 }} contentFit="cover" />
            </View>
            <View className="w-full gap-2">
              <ActionButton label="Use photo" onPress={() => void handleUsePhoto()} theme={theme} loading={saving} />
              <ActionButton label="Choose a different photo" onPress={() => { setPreviewUri(null); setMode('view'); }} theme={theme} variant="ghost" disabled={saving} />
            </View>
          </>
        )}

      </BottomSheetView>
    </BottomSheetModal>
  );
});

function ActionButton({
  label,
  onPress,
  theme,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  theme: any;
  variant?: 'primary' | 'ghost' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? theme.primary :
    variant === 'destructive' ? theme.destructive :
    'transparent';

  const fg =
    variant === 'primary' ? theme.primaryForeground :
    variant === 'destructive' ? theme.destructiveForeground :
    theme.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        paddingVertical: field.paddingV,
        paddingHorizontal: field.paddingH,
        borderRadius: field.radius,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: field.fontSize, fontWeight: '600' }}>
        {loading ? 'Saving...' : label}
      </Text>
    </Pressable>
  );
}
