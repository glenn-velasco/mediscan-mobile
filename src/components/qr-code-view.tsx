import { useMemo } from 'react';
import { Canvas, Fill, Group, Path, Skia } from '@shopify/react-native-skia';

import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';

/**
 * Quiet zone around the modules, in module widths — the QR spec requires a blank margin at least
 * 4 modules wide so scanners can find the finder patterns. Without it (modules drawn edge-to-edge
 * of the canvas) the code relies on whatever background happens to surround this component, which
 * may not be white/wide enough — cameras then fail to lock on, especially at an angle or on a
 * screen with glare. Baking the margin in here makes the code reliably scannable regardless of
 * what it's placed on.
 */
const QUIET_ZONE_MODULES = 4;

/**
 * Renders a QR code via Skia (same rendering pipeline as the lock-screen/notification widget in
 * `src/features/qr-widget/qr-image-generator.ts`) as a single merged path (all dark modules in one
 * shape) instead of one native View per module — a realistic emergency-summary payload produces a
 * ~50x50 module matrix, which as individual Views meant 2500+ native nodes mounted/torn down on
 * every navigation to/from this screen, causing visible jank and occasional ANRs. Fixed white/black
 * colors — this is a real scannable QR code, not themed content; do not restyle with theme tokens.
 */
export function QrCodeView({ value, size = 260 }: { value: string; size?: number }) {
  const matrix = useMemo(() => createQrMatrix(value), [value]);
  const moduleSize = size / (matrix.length + QUIET_ZONE_MODULES * 2);
  const quietZone = moduleSize * QUIET_ZONE_MODULES;
  const path = useMemo(
    () => Skia.Path.MakeFromSVGString(buildQrPath(matrix, moduleSize)),
    [matrix, moduleSize],
  );

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
