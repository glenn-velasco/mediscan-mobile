import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Camera as FaceDetectorCamera, type Face } from 'react-native-vision-camera-face-detector';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import type { CapturedFile } from '@/services/professional-application.service';

// A reading below this average eye-open probability counts as "closed"; above this counts as
// "open". The gap between them is a dead zone so noisy per-frame jitter around ~0.5 doesn't
// register as a spurious blink — mirrors the hysteresis the web reference gets from tracking the
// EAR relative to its recent peak (see mediscan's resources/js/components/liveness-capture.tsx).
const EYES_CLOSED_THRESHOLD = 0.35;
const EYES_OPEN_THRESHOLD = 0.65;
const REQUIRED_BLINKS = 3;
const POSITIONING_TICKS = 3;
const POSITIONING_TIMEOUT_MS = 12_000;
const BLINKING_TIMEOUT_MS = 30_000;
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
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Front-camera liveness capture: waits for a face, requires 3 real blinks (open→closed→open,
 * detected via ML Kit's per-frame eye-open probability), then flashes red/green/blue on screen and
 * captures one frame per color — a direct port of the backend's web liveness-capture.tsx flow (see
 * app/Jobs/ProcessProfessionalApplication.php in the mediscan API for the server-side check this
 * feeds).
 */
export function LivenessCaptureView({ onCaptured, onReset }: { onCaptured: (result: LivenessCaptureResult) => void; onReset: () => void }) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  // Photo capture is a Camera output in vision-camera v5 — captured frames come from this
  // output's capturePhotoToFile(), not from an imperative ref call as in earlier versions.
  const photoOutput = usePhotoOutput({ quality: 0.85 });

  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setErrorMessage] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);

  // Mutable capture state lives in refs, not React state, so the per-frame onFacesDetected
  // callback (fired many times a second) never triggers a re-render on its own.
  const selfieFramesRef = useRef<CapturedFile[]>([]);
  const positioningTicksRef = useRef(0);
  const eyeStateRef = useRef<'open' | 'closed'>('open');
  const completedBlinksRef = useRef(0);
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  const fail = useCallback((message: string) => {
    stoppedRef.current = true;
    setErrorMessage(message);
    setStatus('error');
  }, []);

  const captureFrame = useCallback(async (name: string): Promise<CapturedFile | null> => {
    try {
      const photoFile = await photoOutput.capturePhotoToFile({ flashMode: 'off', enableShutterSound: false }, {});
      return { uri: `file://${photoFile.filePath}`, name, type: 'image/jpeg' };
    } catch (e) {
      console.error('[LivenessCapture] frame capture failed', e);
      return null;
    }
  }, [photoOutput]);

  const runFlashSequence = useCallback(async () => {
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

    if (selfieFramesRef.current.length < 3 || flashFrames.length < 3) {
      fail('Capture failed — please try again.');
      return;
    }

    setStatus('done');
    onCaptured({ selfieFrames: selfieFramesRef.current, flashFrames, flashColors });
  }, [captureFrame, fail, onCaptured]);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      if (busyRef.current || stoppedRef.current) return;
      const face = faces[0];

      setStatus((current) => {
        if (current === 'positioning') {
          void runPositioningTick(face);
        } else if (current === 'blinking') {
          void runBlinkingTick(face);
        }
        return current;
      });

      async function runPositioningTick(f: Face | undefined) {
        deadlineRef.current ??= Date.now() + POSITIONING_TIMEOUT_MS;
        if (Date.now() > deadlineRef.current) {
          fail("We couldn't find your face. Please try again.");
          return;
        }
        if (!f) {
          positioningTicksRef.current = 0;
          return;
        }
        positioningTicksRef.current += 1;
        if (positioningTicksRef.current >= POSITIONING_TICKS) {
          busyRef.current = true;
          deadlineRef.current = null;
          const frame = await captureFrame('selfie-0.jpg');
          if (frame) selfieFramesRef.current.push(frame);
          busyRef.current = false;
          setStatus('blinking');
        }
      }

      async function runBlinkingTick(f: Face | undefined) {
        deadlineRef.current ??= Date.now() + BLINKING_TIMEOUT_MS;
        if (Date.now() > deadlineRef.current) {
          fail(`We only detected ${completedBlinksRef.current} of ${REQUIRED_BLINKS} blinks. Please try again and blink naturally.`);
          return;
        }
        if (!f) return;

        const left = f.leftEyeOpenProbability ?? 1;
        const right = f.rightEyeOpenProbability ?? 1;
        const avg = (left + right) / 2;
        const isClosed = avg <= EYES_CLOSED_THRESHOLD;
        const isOpen = avg >= EYES_OPEN_THRESHOLD;

        if (isClosed && eyeStateRef.current === 'open') {
          eyeStateRef.current = 'closed';
          busyRef.current = true;
          const frame = await captureFrame(`selfie-blink-${completedBlinksRef.current}-closed.jpg`);
          if (frame) selfieFramesRef.current.push(frame);
          busyRef.current = false;
        } else if (isOpen && eyeStateRef.current === 'closed') {
          eyeStateRef.current = 'open';
          completedBlinksRef.current += 1;
          setBlinkCount(completedBlinksRef.current);

          busyRef.current = true;
          const frame = await captureFrame(`selfie-blink-${completedBlinksRef.current}-open.jpg`);
          if (frame) selfieFramesRef.current.push(frame);
          busyRef.current = false;

          if (completedBlinksRef.current >= REQUIRED_BLINKS) {
            deadlineRef.current = null;
            void runFlashSequence();
          }
        }
      }
    },
    [captureFrame, fail, runFlashSequence],
  );

  const start = useCallback(async () => {
    setErrorMessage(null);
    stoppedRef.current = false;
    busyRef.current = false;
    selfieFramesRef.current = [];
    positioningTicksRef.current = 0;
    completedBlinksRef.current = 0;
    eyeStateRef.current = 'open';
    deadlineRef.current = null;
    setBlinkCount(0);
    setFlashIndex(null);

    setStatus('requesting');
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        fail('Camera access is needed to verify your identity.');
        return;
      }
    }
    setStatus('positioning');
  }, [hasPermission, requestPermission, fail]);

  const retry = useCallback(() => {
    stoppedRef.current = true;
    setStatus('idle');
    setErrorMessage(null);
    setBlinkCount(0);
    setFlashIndex(null);
    onReset();
  }, [onReset]);

  const isLive = status === 'positioning' || status === 'blinking' || status === 'flashing';

  if (!device) {
    return (
      <View className="items-center gap-4 py-8">
        <ThemedText color="mutedForeground" className="text-center">
          No front camera available.
        </ThemedText>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="relative aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-black">
        {status === 'idle' || status === 'error' ? (
          <ThemedText color="mutedForeground" className="px-4 text-center text-sm">
            Camera preview will appear here.
          </ThemedText>
        ) : (
          <FaceDetectorCamera
            style={{ width: '100%', height: '100%' }}
            device={device}
            isActive={isLive}
            outputs={[photoOutput]}
            runClassifications
            performanceMode="fast"
            onFacesDetected={handleFacesDetected}
            onError={(e) => {
              console.error('[LivenessCapture] camera error', e);
              fail('Camera error — please try again.');
            }}
          />
        )}

        {status === 'flashing' && flashIndex !== null && (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: FLASH_BACKGROUND[FLASH_COLORS[flashIndex]] }}
          >
            <ThemedText style={{ color: '#fff' }}>Hold still…</ThemedText>
          </View>
        )}

        {isLive && status !== 'flashing' && (
          <View className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1">
            <ThemedText type="small" style={{ color: '#fff' }}>
              {status === 'positioning' && 'Look at the camera…'}
              {status === 'blinking' && `Blink naturally… ${blinkCount}/${REQUIRED_BLINKS}`}
            </ThemedText>
          </View>
        )}

        {status === 'done' && (
          <ThemedText color="mutedForeground" className="px-4 text-center text-sm">
            Capture complete.
          </ThemedText>
        )}
      </View>

      {error ? (
        <ThemedText type="small" color="destructive">
          {error}
        </ThemedText>
      ) : null}

      {status === 'idle' || status === 'error' ? (
        <PrimaryButton label={status === 'error' ? 'Retry capture' : 'Start selfie capture'} variant="ghost" onPress={() => void start()} />
      ) : status === 'done' ? (
        <PrimaryButton label="Retake" variant="ghost" onPress={retry} />
      ) : (
        <PrimaryButton
          label={
            status === 'requesting' ? 'Requesting camera…' : status === 'positioning' ? 'Positioning…' : status === 'blinking' ? 'Waiting for blinks…' : 'Flashing…'
          }
          loading
          disabled
        />
      )}
    </View>
  );
}
