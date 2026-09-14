import { Platform } from 'react-native';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import { Paths, Directory } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';
import { QR_HYBRID_PREFIX } from '@/lib/emergency-qr-hybrid';

const QR_IMAGE_FILENAME = 'emergency_qr.png';
/**
 * Sized for the largest surface it lands on: the full-screen lock-screen QR. 512 upscales
 * ~3x on a 1440p display and softens the module edges a scanner reads; a QR is 1-bit content,
 * so the extra resolution costs little in PNG.
 */
const QR_IMAGE_SIZE = 1024;

export async function generateQrImage(encryptedText: string): Promise<string | null> {
  try {
    const surface = Skia.Surface.Make(QR_IMAGE_SIZE, QR_IMAGE_SIZE);
    if (!surface) {
      return null;
    }

    const canvas = surface.getCanvas();
    const matrix = createQrMatrix(encryptedText, encryptedText.startsWith(QR_HYBRID_PREFIX) ? 'M' : 'L');
    const padding = (QR_IMAGE_SIZE / matrix.length) * 4;
    const qrArea = QR_IMAGE_SIZE - padding * 2;

    const whitePaint = Skia.Paint();
    whitePaint.setColor(Skia.Color('white'));
    canvas.drawRect(Skia.XYWHRect(0, 0, QR_IMAGE_SIZE, QR_IMAGE_SIZE), whitePaint);

    const blackPaint = Skia.Paint();
    blackPaint.setColor(Skia.Color('black'));

    const scaledModule = qrArea / matrix.length;
    const path = Skia.Path.MakeFromSVGString(buildQrPath(matrix, scaledModule));
    if (path) {
      canvas.save();
      canvas.translate(padding, padding);
      canvas.drawPath(path, blackPaint);
      canvas.restore();
    }

    const image = surface.makeImageSnapshot();
    const pngBase64 = image.encodeToBase64(ImageFormat.PNG, 100);

    const destDir = Platform.OS === 'ios' && widgetsDirectory
      ? widgetsDirectory
      : Paths.cache.uri;

    const dir = new Directory(destDir);
    if (!dir.exists) {
      dir.create();
    }

    const file = dir.createFile(QR_IMAGE_FILENAME, 'image/png');
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(pngBase64, { encoding: 'base64' });

    return file.uri;
  } catch (e) {
    console.warn('Failed to generate QR image:', e);
    return null;
  }
}
