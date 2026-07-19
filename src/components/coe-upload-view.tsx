import { useCallback, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { Card } from '@/components/card';
import { useTheme } from '@/hooks/use-theme';

export type CapturedFile = { uri: string; name: string; type: string };

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export function CoeUploadView({ onPicked }: { onPicked: (file: CapturedFile) => void }) {
  const theme = useTheme();
  const [picked, setPicked] = useState<CapturedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      setError('File is too large — max 10MB.');
      return;
    }

    const file: CapturedFile = {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
    };
    setPicked(file);
    onPicked(file);
  }, [onPicked]);

  return (
    <View className="gap-3">
      {picked ? (
        <Card className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
            <Ionicons name="document-text" size={18} color={theme.primary} />
          </View>
          <ThemedText className="flex-1 shrink font-semibold" numberOfLines={1}>
            {picked.name}
          </ThemedText>
        </Card>
      ) : (
        <ThemedText color="mutedForeground" className="text-center">
          Upload your Certificate of Employment (PDF or image, max 10MB).
        </ThemedText>
      )}
      {error ? (
        <ThemedText type="small" color="destructive">
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label={picked ? 'Choose a different file' : 'Choose file'} variant={picked ? 'ghost' : 'primary'} onPress={pick} />
    </View>
  );
}
