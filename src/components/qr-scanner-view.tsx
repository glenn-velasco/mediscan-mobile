import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3;
const CORNER_RADIUS = 16;

const cornerBase = {
  position: 'absolute' as const,
  width: CORNER_SIZE,
  height: CORNER_SIZE,
};

/**
 * Live camera viewfinder framed for QR scanning. Calls `onScanned` once per distinct scan (a
 * simple ref-based guard prevents the same code firing repeatedly per frame while the camera
 * keeps scanning) — callers should stop rendering this component once they've handled a result.
 *
 * `fullscreen` renders the native-scanner-style overlay (corner-bracket viewfinder that flashes to
 * `accentColor` once a code locks in, plus a "Scan QR code" label) used by the QR tile's quick-scan
 * screen; the compact (non-fullscreen) form used inline in the manage-info bottom sheet keeps the
 * simpler bordered frame. `torchOn` is controlled by the caller so it can live in a shared top bar.
 */
export function QrScannerView({
  onScanned,
  fullscreen = false,
  torchOn = false,
  accentColor,
  continuous = false,
}: {
  onScanned: (data: string) => void;
  fullscreen?: boolean;
  torchOn?: boolean;
  accentColor: string;
  continuous?: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [enabled, setEnabled] = useState(true);
  const lastScanned = useRef<string | null>(null);
  const candidate = useRef<{ data: string; count: number } | null>(null);
  const { width } = useWindowDimensions();
  const frameSize = Math.min(Math.round(width * 0.7), 280);
  const lockProgress = useSharedValue(0);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!enabled) return;
    if (candidate.current?.data === result.data) candidate.current.count += 1;
    else candidate.current = { data: result.data, count: 1 };
    if (candidate.current.count < 2) return;
    if (lastScanned.current === result.data) return;
    lastScanned.current = result.data;
    setEnabled(false);
    onScanned(result.data);
    if (continuous) {
      setTimeout(() => {
        candidate.current = null;
        setEnabled(true);
      }, 180);
    }
  };

  useEffect(() => {
    lockProgress.set(withTiming(enabled ? 0 : 1, { duration: 220 }));
  }, [enabled, lockProgress]);

  const cornerColorStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(lockProgress.value, [0, 1], ['#ffffff', accentColor]),
  }));

  const cornerContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(lockProgress.value, [0, 1], [1, 1.08]) }],
  }));

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View className={fullscreen ? 'flex-1 items-center justify-center gap-4 bg-black px-8' : 'items-center gap-4 py-8'}>
        <ThemedText color={fullscreen ? undefined : 'mutedForeground'} className="text-center" style={fullscreen ? { color: '#fff' } : undefined}>
          Camera access is needed to scan a QR code.
        </ThemedText>
        <PrimaryButton label="Grant camera access" onPress={() => void requestPermission()} />
      </View>
    );
  }

  if (!fullscreen) {
    return (
      <View className="aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black">
        <CameraView
          style={{ width: '100%', height: '100%' }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={enabled ? handleBarcodeScanned : undefined}
        />
        <View pointerEvents="none" className="absolute rounded-lg border-2 border-white/80" style={{ width: frameSize, height: frameSize }} />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-black">
      <CameraView
        style={{ width: '100%', height: '100%' }}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={enabled ? handleBarcodeScanned : undefined}
      />
      <View pointerEvents="none" className="absolute items-center" style={{ gap: 16 }}>
        <Animated.View style={[{ width: frameSize, height: frameSize }, cornerContainerStyle]}>
          <Animated.View
            style={[
              cornerBase,
              { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: CORNER_RADIUS },
              cornerColorStyle,
            ]}
          />
          <Animated.View
            style={[
              cornerBase,
              { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: CORNER_RADIUS },
              cornerColorStyle,
            ]}
          />
          <Animated.View
            style={[
              cornerBase,
              { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: CORNER_RADIUS },
              cornerColorStyle,
            ]}
          />
          <Animated.View
            style={[
              cornerBase,
              { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: CORNER_RADIUS },
              cornerColorStyle,
            ]}
          />
        </Animated.View>
        <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Scan QR code
        </ThemedText>
      </View>
    </View>
  );
}
