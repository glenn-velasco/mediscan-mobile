import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { generateQrImage } from '@/features/qr-widget/qr-image-generator';
import { formatWalletCardTimestamps } from '@/lib/wallet-card-timestamps';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

let isSharingInProgress = false;

export async function shareEmergencyWalletCard(qrPayload: string, displayName: string, issuedAt: string, medicalDataUpdatedAt?: string | null): Promise<void> {
  if (isSharingInProgress) return;
  isSharingInProgress = true;
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) return;

    const imageUri = await generateQrImage(qrPayload);
    if (!imageUri) throw new Error('Unable to render the emergency QR.');
    const qrBase64 = await new File(imageUri).base64();
    const { issued, updated } = formatWalletCardTimestamps(issuedAt, medicalDataUpdatedAt);
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      @page{size:3in 1.875in;margin:0}*{box-sizing:border-box}html,body{width:3in;height:1.875in;margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#111}.card{width:3in;height:1.875in;border:1px solid #0d7377;border-radius:8px;padding:8px;display:flex;align-items:center;gap:8px;overflow:hidden}
      .qr{width:1.12in;height:1.12in;flex:none;object-fit:contain}.details{min-width:0;flex:1;overflow:hidden}
      h1{font-size:11px;line-height:1.1;margin:0 0 4px}strong{display:block;font-size:9px;line-height:1.15;overflow-wrap:anywhere}
      p{font-size:7px;line-height:1.15;margin:4px 0 0}.meta{font-size:6px;color:#444;line-height:1.15}
      </style></head><body><main class="card">
        <img class="qr" alt="Emergency QR" src="data:image/png;base64,${qrBase64}" />
        <section class="details"><h1>MediScan<br>Emergency Card</h1><strong>${escapeHtml(displayName || 'Emergency profile')}</strong><p>Scan with MediScan.</p><p class="meta">Internet required<br>Issued ${escapeHtml(issued)}<br>Medical data updated ${escapeHtml(updated)}</p></section>
      </main></body></html>`;
    const { uri } = await Print.printToFileAsync({ html, width: 216, height: 135 });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share emergency wallet card' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Another share request is being processed')) {
      return;
    }
    throw err;
  } finally {
    isSharingInProgress = false;
  }
}
