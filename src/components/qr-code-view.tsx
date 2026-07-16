import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';

/**
 * Renders a QR code as a single SVG path (all dark modules merged into one shape) instead of one
 * native View per module — a realistic emergency-summary payload produces a ~50x50 module matrix,
 * which as individual Views meant 2500+ native nodes mounted/torn down on every navigation to/from
 * this screen, causing visible jank and occasional ANRs. Fixed white/black colors — this is a real
 * scannable QR code, not themed content; do not restyle with theme tokens.
 */
export function QrCodeView({ value, size = 260 }: { value: string; size?: number }) {
  const matrix = useMemo(() => createQrMatrix(value), [value]);
  const moduleSize = size / matrix.length;
  const path = useMemo(() => buildQrPath(matrix, moduleSize), [matrix, moduleSize]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" />
      <Path d={path} fill="#000" />
    </Svg>
  );
}
