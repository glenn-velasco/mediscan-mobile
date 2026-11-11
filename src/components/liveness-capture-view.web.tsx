import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import type { CapturedFile } from '@/services/professional-application.service';

const REQUIRED_BLINKS = 3;
const FLASH_COLORS = ['red', 'green', 'blue'] as const;
const FLASH_DWELL_MS = 700;
const FLASH_BACKGROUND: Record<(typeof FLASH_COLORS)[number], string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
};

type CaptureStatus = 'idle' | 'requesting' | 'positioning' | 'blinking' | 'flashing' | 'done' | 'error';

export type LivenessCaptureResult = {
  selfieFrames: CapturedFile[];
  flashFrames: CapturedFile[];
  flashColors: string[];
  blinkDetected: boolean;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function LivenessCaptureView({
  onCaptured,
  onReset,
}: {
  onCaptured: (result: LivenessCaptureResult) => void;
  onReset: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setErrorMessage] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const stoppedRef = useRef(false);

  const fail = useCallback((message: string) => {
    stoppedRef.current = true;
    setErrorMessage(message);
    setStatus('error');
  }, []);

  const captureFrame = useCallback(async (name: string): Promise<CapturedFile | null> => {
    if (stoppedRef.current || !cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return null;
      return { uri: photo.uri, name, type: 'image/jpeg' };
    } catch (e) {
      console.error('[LivenessCapture.web] frame capture failed', e);
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    setErrorMessage(null);
    stoppedRef.current = false;
    setBlinkCount(0);
    setFlashIndex(null);

    setStatus('requesting');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        fail('Camera access is needed to verify your identity.');
        return;
      }
    }

    setStatus('positioning');
    await wait(1200);
    if (stoppedRef.current) return;

    const selfieFrames: CapturedFile[] = [];
    const initialFrame = await captureFrame('selfie-0.jpg');
    if (initialFrame) selfieFrames.push(initialFrame);

    setStatus('blinking');
    for (let blink = 1; blink <= REQUIRED_BLINKS; blink++) {
      await wait(900);
      if (stoppedRef.current) return;
      const closedFrame = await captureFrame(`selfie-blink-${blink - 1}-closed.jpg`);
      if (closedFrame) selfieFrames.push(closedFrame);
      await wait(500);
      if (stoppedRef.current) return;
      const openFrame = await captureFrame(`selfie-blink-${blink}-open.jpg`);
      if (openFrame) selfieFrames.push(openFrame);
      setBlinkCount(blink);
    }

    setStatus('flashing');
    const flashFrames: CapturedFile[] = [];
    const flashColors: string[] = [];

    for (let i = 0; i < FLASH_COLORS.length; i++) {
      if (stoppedRef.current) return;
      setFlashIndex(i);
      await wait(FLASH_DWELL_MS);
      const frame = await captureFrame(`flash-${FLASH_COLORS[i]}.jpg`);
      if (frame) {
        flashFrames.push(frame);
        flashColors.push(FLASH_COLORS[i]);
      }
    }

    setFlashIndex(null);

    if (selfieFrames.length < 3 || flashFrames.length < 3) {
      fail('Capture failed — please try again.');
      return;
    }

    setStatus('done');
    onCaptured({ selfieFrames, flashFrames, flashColors, blinkDetected: true });
  }, [permission, requestPermission, fail, captureFrame, onCaptured]);

  const retry = useCallback(() => {
    stoppedRef.current = true;
    setStatus('idle');
    setErrorMessage(null);
    setBlinkCount(0);
    setFlashIndex(null);
    onReset();
  }, [onReset]);

  const isLive = status === 'positioning' || status === 'blinking' || status === 'flashing';

  return (
    <View className="gap-3">
      <View className="relative aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-black">
        {!isLive ? (
          <ThemedText color="mutedForeground" className="px-4 text-center text-sm">
            {status === 'done' ? 'Capture complete.' : 'Camera preview will appear here.'}
          </ThemedText>
        ) : (
          <CameraView ref={cameraRef} style={{ width: '100%', height: '100%' }} facing="front" />
        )}

        {status === 'flashing' && flashIndex !== null && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: FLASH_BACKGROUND[FLASH_COLORS[flashIndex]], opacity: 0.75 }}
          >
            <ThemedText style={{ color: '#fff' }}>Hold still…</ThemedText>
          </View>
        )}

        {(status === 'positioning' || status === 'blinking') && (
          <View className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1">
            <ThemedText type="small" style={{ color: '#fff' }}>
              {status === 'positioning' && 'Look at the camera…'}
              {status === 'blinking' && `Blink naturally… ${blinkCount}/${REQUIRED_BLINKS}`}
            </ThemedText>
          </View>
        )}
      </View>

      {error ? (
        <ThemedText type="small" color="destructive">
          {error}
        </ThemedText>
      ) : null}

      {status === 'idle' ? (
        <PrimaryButton label="Start selfie capture" variant="primary" onPress={() => void start()} />
      ) : status === 'error' ? (
        <PrimaryButton label="Retry capture" variant="outline" onPress={() => void start()} />
      ) : status === 'done' ? (
        <PrimaryButton label="Retake" variant="outline" onPress={retry} />
      ) : (
        <PrimaryButton
          label={
            status === 'requesting'
              ? 'Requesting camera…'
              : status === 'positioning'
                ? 'Positioning…'
                : status === 'blinking'
                  ? 'Waiting for blinks…'
                  : 'Flashing…'
          }
          loading
          disabled
        />
      )}
    </View>
  );
}
