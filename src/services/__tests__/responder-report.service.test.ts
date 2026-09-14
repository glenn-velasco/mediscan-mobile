import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildResponderReportHtml, shareResponderReport } from '@/services/responder-report.service';
import type { RecentEmergencyScan } from '@/types/emergency';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const scan = {
  scannedAt: '2026-09-14T10:00:00.000Z',
  source: 'dynamic-card',
  info: {
    name: 'Test Patient', generatedAt: '2026-09-14T09:00:00.000Z', lastUpdatedAt: '2026-09-14T08:00:00.000Z',
    bloodType: 'O+', noBloodTransfusion: 'Yes',
    allergies: [{ allergen: '<Peanuts>', severity: 'severe', reaction: null }],
    medications: [], conditions: [], diagnoses: [], emergencyContacts: [],
  },
  encounter: {
    authorName: 'Alex <script>', authorIdentity: 'self_declared',
    observations: 'Patient was awake & speaking', actionsTaken: 'Called for assistance',
    recordedAt: '2026-09-14T10:01:00.000Z', updatedAt: '2026-09-14T10:02:00.000Z',
    vitals: [{ kind: 'heart_rate', value: '88', unit: 'bpm', measuredAt: '2026-09-14T10:01:00.000Z', recordedBy: 'Alex' }],
  },
  note: { text: 'Observed <alert> & helped', updatedAt: '2026-09-14T10:01:00.000Z', title: 'Scene note' },
} as unknown as RecentEmergencyScan;

describe('responder report', () => {
  it('separates patient facts from responder entries and escapes entered text', () => {
    const html = buildResponderReportHtml(scan);
    expect(html).toContain('Patient-provided QR information');
    expect(html).toContain('Responder-entered information');
    expect(html).toContain('Name entered by responder');
    expect(html).toContain('&lt;Peanuts&gt;');
    expect(html).toContain('Alex &lt;script&gt;');
    expect(html).toContain('awake &amp; speaking');
    expect(html).toContain('heart rate');
    expect(html).toContain('Printed card; online published snapshot');
    expect(html).toContain('Observed &lt;alert&gt; &amp; helped');
    expect(html).not.toContain('<script>');
  });

  it('requires saved encounter details', () => {
    expect(() => buildResponderReportHtml({ ...scan, encounter: null })).toThrow('Save encounter details');
  });

  it('embeds every responder note photo in the PDF HTML', async () => {
    const withPhotos = {
      ...scan,
      note: {
        title: 'Scene note', text: 'Photo evidence', updatedAt: '2026-09-14T10:01:00.000Z',
        blocks: [
          { id: 'text-1', type: 'text' as const, text: 'Photo evidence', createdAt: '2026-09-14T10:01:00.000Z' },
          { id: 'image-1', type: 'image' as const, uri: 'file:///photo-1.jpg', createdAt: '2026-09-14T10:02:00.000Z' },
          { id: 'image-2', type: 'image' as const, uri: 'file:///photo-2.png', createdAt: '2026-09-14T10:03:00.000Z' },
        ],
      },
    } as RecentEmergencyScan;
    jest.mocked(File).mockImplementation((uri) => ({ exists: true, type: String(uri).endsWith('.png') ? 'image/png' : 'image/jpeg', base64: async () => 'ZmFrZQ==' }) as File);
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Print.printToFileAsync).mockResolvedValue({ uri: 'file:///report.pdf', numberOfPages: 1 });
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);

    await shareResponderReport(withPhotos);

    const html = jest.mocked(Print.printToFileAsync).mock.calls[0][0]?.html ?? '';
    expect(html).toContain('data:image/jpeg;base64,ZmFrZQ==');
    expect(html).toContain('data:image/png;base64,ZmFrZQ==');
    expect(html).toContain('Responder-added photo 1');
    expect(html).toContain('Responder-added photo 2');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///report.pdf', expect.any(Object));
  });

  it('refuses export if a note photo cannot be read', async () => {
    const withPhoto = { ...scan, note: { text: '', updatedAt: '2026-09-14T10:01:00.000Z', photoUris: ['file:///missing.jpg'] } } as RecentEmergencyScan;
    jest.mocked(File).mockImplementation(() => ({ exists: false }) as File);
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Print.printToFileAsync).mockClear();
    await expect(shareResponderReport(withPhoto)).rejects.toThrow('Note photo 1 could not be included');
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });
});
