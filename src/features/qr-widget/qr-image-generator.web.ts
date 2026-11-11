import QRCode from 'qrcode';

import { QR_HYBRID_PREFIX } from '@/lib/emergency-qr-hybrid';

const QR_IMAGE_SIZE = 1024;

export async function generateQrImage(encryptedText: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(encryptedText, {
      errorCorrectionLevel: encryptedText.startsWith(QR_HYBRID_PREFIX) ? 'M' : 'L',
      width: QR_IMAGE_SIZE,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (e) {
    console.warn('Failed to generate web QR image:', e);
    return null;
  }
}
