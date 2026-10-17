import { Canvas, Fill, Group, Path, Skia } from '@shopify/react-native-skia';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const QUIET_ZONE_MODULES = 4;

export function QrCodeView({
  value,
  size = 260,
  fallback,
}: {
  value: string;
  size?: number;
  fallback?: React.ReactNode;
}) {
  const theme = useTheme();
  const matrix = createQrMatrix(value);

  if (!matrix) {
    if (fallback) return <>{fallback}</>;
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Ionicons name="warning-outline" size={32} color={theme.destructive} style={{ marginBottom: 8 }} />
        <ThemedText type="bodyBold" style={{ textAlign: 'center', marginBottom: 4 }}>
          QR Code Too Large
        </ThemedText>
        <ThemedText color="mutedForeground" style={{ textAlign: 'center', fontSize: 12 }}>
          Your medical record has too much detail to fit in an offline QR code. Please shorten your notes or print a wallet card.
        </ThemedText>
      </View>
    );
  }

  const moduleSize = size / (matrix.length + QUIET_ZONE_MODULES * 2);
  const quietZone = moduleSize * QUIET_ZONE_MODULES;
  const path = Skia.Path.MakeFromSVGString(buildQrPath(matrix, moduleSize));

  return (
    <Canvas style={{ width: size, height: size }}>
      <Fill color="white" />
      {path ? (
        <Group transform={[{ translateX: quietZone }, { translateY: quietZone }]}>
          <Path path={path} color="black" />
        </Group>
      ) : null}
    </Canvas>
  );
}
