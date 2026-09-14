import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { RecentEmergencyScan } from '@/types/emergency';

function escapeHtml(value: string | null | undefined): string {
  return (value || 'Not recorded').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function row(label: string, value: string | null | undefined): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function list(values: string[]): string {
  return values.length ? `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '<p>Not recorded</p>';
}

type ReportPhoto = { dataUri: string; addedAt: string | null };

function noteImages(scan: RecentEmergencyScan): { uri: string; addedAt: string | null }[] {
  if (scan.note?.blocks) return scan.note.blocks.filter((block) => block.type === 'image').map((block) => ({ uri: block.uri, addedAt: block.createdAt }));
  return (scan.note?.photoUris ?? []).map((uri) => ({ uri, addedAt: scan.note?.updatedAt ?? null }));
}

async function loadNotePhotos(scan: RecentEmergencyScan): Promise<ReportPhoto[]> {
  const images = noteImages(scan);
  const photos: ReportPhoto[] = [];
  for (const [index, image] of images.entries()) {
    try {
      const file = new File(image.uri);
      if (!file.exists) throw new Error('Image file is missing');
      const mimeType = file.type || (/\.png(?:\?|$)/i.test(image.uri) ? 'image/png' : /\.webp(?:\?|$)/i.test(image.uri) ? 'image/webp' : 'image/jpeg');
      if (!/^image\/(?:jpeg|png|webp)$/.test(mimeType)) throw new Error(`Unsupported image type: ${mimeType}`);
      photos.push({ dataUri: `data:${mimeType};base64,${await file.base64()}`, addedAt: image.addedAt });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'Unable to read image';
      throw new Error(`Note photo ${index + 1} could not be included (${reason}). Restore or remove it before exporting.`);
    }
  }
  return photos;
}

export function buildResponderReportHtml(scan: RecentEmergencyScan, photos: ReportPhoto[] = []): string {
  const { info, encounter } = scan;
  if (!encounter) throw new Error('Save encounter details before generating a report.');
  const noteText = scan.note?.blocks
    ? scan.note.blocks.filter((block) => block.type === 'text').map((block) => block.text).filter(Boolean).join('\n\n')
    : scan.note?.text ?? '';
  const photoCount = noteImages(scan).length;
  if (photos.length !== photoCount) throw new Error('All note photos must be loaded before generating the report.');
  const photoHtml = photos.map((photo, index) => `<figure><img src="${photo.dataUri}" alt="Responder note photo ${index + 1}" /><figcaption>Responder-added photo ${index + 1}${photo.addedAt ? ` · added ${escapeHtml(new Date(photo.addedAt).toLocaleString())}` : ''}</figcaption></figure>`).join('');
  const vitals = encounter.vitals.length
    ? `<table><thead><tr><th>Vital</th><th>Value</th><th>Measured at</th><th>Entered by</th></tr></thead><tbody>${encounter.vitals.map((vital) => `<tr><td>${escapeHtml(vital.kind.replace(/_/g, ' '))}</td><td>${escapeHtml(`${vital.value} ${vital.unit}`)}</td><td>${escapeHtml(new Date(vital.measuredAt).toLocaleString())}</td><td>${escapeHtml(vital.recordedBy)}</td></tr>`).join('')}</tbody></table>`
    : '<p>Not recorded</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#172425;margin:32px;font-size:12px;line-height:1.4}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #b8c8c7;padding-bottom:4px}
    .notice{background:#e9f5f3;padding:12px;border-radius:6px}.warning{color:#8c3300;font-weight:bold}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6e0df;padding:7px;text-align:left;vertical-align:top}th{background:#f3f7f6}
    ul{padding-left:20px}li{margin:3px 0}p{white-space:pre-wrap}
    figure{margin:12px 0 20px;break-inside:avoid;page-break-inside:avoid}figure img{display:block;max-width:100%;max-height:620px;object-fit:contain}figcaption{font-size:10px;color:#506161;margin-top:5px}
  </style></head><body>
    <h1>MediScan encounter report</h1>
    <p class="notice">Locally prepared responder record. Patient facts come from a QR snapshot; observations and vitals were entered separately. This is not a verified clinical record.</p>
    <table>${row('Scan time', new Date(scan.scannedAt).toLocaleString())}${row('Source', scan.source === 'dynamic-card' ? 'Printed card; online published snapshot' : scan.source === 'printable-offline' ? 'Printed card; offline snapshot that may be outdated or revoked' : 'On-phone QR; available offline')}${row('Report updated', new Date(encounter.updatedAt).toLocaleString())}${row('Name entered by responder', encounter.authorName || 'Not recorded')}</table>
    <h2>Patient-provided QR information</h2>
    <table>${row('Name', info.name)}${row('QR generated', info.generatedAt ? new Date(info.generatedAt).toLocaleString() : null)}${row('Patient information last updated', info.lastUpdatedAt ? new Date(info.lastUpdatedAt).toLocaleString() : null)}${row('Blood type', info.bloodType)}${row('Transfusion preference', info.noBloodTransfusion)}</table>
    <h2>Allergies</h2>${list(info.allergies.map((item) => `${item.allergen} — ${item.severity}${item.reaction ? `; reaction: ${item.reaction}` : ''}`))}
    <h2>Medications</h2>${list(info.medications.map((item) => `${item.name} — ${item.dosage}${item.frequency ? `; ${item.frequency}` : ''}`))}
    <h2>Conditions and diagnoses</h2>${list([...info.conditions.map((item) => item.description), ...info.diagnoses.map((item) => item.condition)])}
    <h2>Emergency contacts</h2>${list(info.emergencyContacts.map((item) => `${item.name}${item.relationship ? ` (${item.relationship})` : ''}${item.phone ? ` — ${item.phone}` : ''}`))}
    <h2>Responder-entered information</h2>
    <table>${row('Responder observations', [scan.note?.title, noteText].filter(Boolean).join('\n\n'))}${encounter.observations ? row('Earlier observations from a previous report', encounter.observations) : ''}${row('Actions taken', encounter.actionsTaken)}</table>
    ${photoCount ? `<h2>Responder-added photos</h2>${photoHtml}` : ''}
    <h2>Vitals measured during this encounter</h2>${vitals}
    <p class="warning">Confirm patient-provided information when possible. Blank fields mean not recorded, not a confirmed absence.</p>
  </body></html>`;
}

export async function shareResponderReport(scan: RecentEmergencyScan): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  const photos = await loadNotePhotos(scan);
  const { uri } = await Print.printToFileAsync({ html: buildResponderReportHtml(scan, photos) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share encounter report' });
}
