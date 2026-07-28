import { Canvas, Fill, Group, Path, Skia } from '@shopify/react-native-skia';

import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';

const QUIET_ZONE_MODULES = 4;

export function QrCodeView({ value, size = 260 }: { value: string; size?: number }) {
  const matrix = createQrMatrix(value);
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
