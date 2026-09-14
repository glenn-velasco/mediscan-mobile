import { render } from '@testing-library/react-native';

import { InfoTile } from '@/components/info-tile';
import { ScannedEmergencyCard } from '@/components/scanned-emergency-card';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    foreground: '#ffffff', mutedForeground: '#aaaaaa', muted: '#333333',
    primary: '#008899', warning: '#ffaa00', destructive: '#ff5555',
    success: '#22aa77', card: '#222222', border: '#444444',
  }),
}));

const info: ScannedEmergencyInfo = {
  patientId: 'patient-1', generatedAt: '2026-09-14T09:00:00Z',
  name: 'Sample Patient', firstName: 'Sample', middleName: '', lastName: 'Patient', suffix: '',
  dateOfBirth: '2000-07-25', gender: 'male', bloodType: 'o_positive', religion: '',
  noBloodTransfusion: 'No', phone: '9369743555', phoneCountryCode: 'PH',
  street: '', unit: '', city: '', province: '', postalCode: '', country: '',
  allergies: [], conditions: [], diagnoses: [], medications: [], emergencyContacts: [],
  withheld: { dateOfBirth: false, bloodType: false, phone: false },
};

describe('emergency information layout', () => {
  it('renders DOB, phone, and other facts as full-width rows', async () => {
    const screen = await render(<ScannedEmergencyCard info={info} showMedicalDetails={false} />);
    for (const label of ['Date of birth', 'Age', 'Gender', 'Blood type', 'Phone', 'No blood transfusion', 'Generated']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.root!.queryAll((node) => typeof node.props.className === 'string' && node.props.className.includes('w-full')).length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('July 25, 2000')).toBeTruthy();
  });

  it('allows full-width values to wrap instead of truncating them', async () => {
    const screen = await render(<InfoTile fullWidth icon="call" iconColor="#008899" iconBgKey="primary" label="Phone" value="+63 9369743555" />);
    expect(screen.getByText('+63 9369743555').props.numberOfLines).toBeUndefined();
  });

  it('shows the original detail sections and a callable contact for an offline wallet scan', async () => {
    const screen = await render(<ScannedEmergencyCard info={{
      ...info,
      allergies: [{ allergen: 'Peanuts', severity: 'severe', reaction: null }],
      medications: [{ name: 'Salbutamol', dosage: '100 mcg', frequency: null }],
      emergencyContacts: [{ name: 'Alex', relationship: 'Parent', phone: '+639123456789' }],
    }} source="printable-offline" />);
    expect(screen.getByText(/Printed card · offline snapshot/)).toBeTruthy();
    expect(screen.getByText('Emergency contacts')).toBeTruthy();
    expect(screen.getByText('Allergies')).toBeTruthy();
    expect(screen.getByText('Medications')).toBeTruthy();
    expect(screen.getAllByText(/Peanuts/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Salbutamol/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Call Alex').length).toBeGreaterThan(0);
  });
});
