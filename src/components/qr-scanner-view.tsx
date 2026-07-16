import { useCallback, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';

/**
 * Live camera viewfinder framed for QR scanning. Calls `onScanned` once per distinct scan (a
 * simple ref-based guard prevents the same code firing repeatedly per frame while the camera
 * keeps scanning) — callers should stop rendering this component once they've handled a result.
 */
export function QrScannerView({ onScanned }: { onScanned: (data: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [enabled, setEnabled] = useState(true);
  const lastScanned = useRef<string | null>(null);
  const { width } = useWindowDimensions();
  const frameSize = Math.min(Math.round(width * 0.5), 280);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!enabled || lastScanned.current === result.data) return;
      lastScanned.current = result.data;
      setEnabled(false);
      onScanned(result.data);
    },
    [enabled, onScanned],
  );

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View className="items-center gap-4 py-8">
        <ThemedText color="mutedForeground" className="text-center">
          Camera access is needed to scan a QR code.
        </ThemedText>
        <PrimaryButton label="Grant camera access" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <View className="aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black">
      <CameraView
        style={{ width: '100%', height: '100%' }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={enabled ? handleBarcodeScanned : undefined}
      />
      <View
        pointerEvents="none"
        className="absolute rounded-lg border-2 border-white/80"
        style={{ width: frameSize, height: frameSize }}
      />
    </View>
  );
}
