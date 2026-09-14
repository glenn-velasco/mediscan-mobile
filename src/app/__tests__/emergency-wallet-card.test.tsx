import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EmergencyWalletCardScreen from '@/app/emergency-wallet-card';

const mockGetDynamicCard = jest.fn();
const mockGetEmergencyCardStatus = jest.fn();
const mockResolveEmergencyCard = jest.fn();
const mockShareEmergencyWalletCard = jest.fn();
const mockBuildPrintableEmergencyCardQr = jest.fn();

jest.mock('@/auth/useAuth', () => {
  const user = { id: 'patient-1', first_name: 'Sample', last_name: 'Patient' };
  return { useAuth: () => ({ user }) };
});
jest.mock('@/hooks/use-theme', () => ({ useTheme: () => ({ primary: '#008899' }) }));
jest.mock('@/db/repositories/dynamic-emergency-card.repo', () => ({
  getDynamicCard: (...args: unknown[]) => mockGetDynamicCard(...args),
  removeDynamicCard: jest.fn(),
}));
jest.mock('@/api/endpoints/emergency-wallet-card', () => ({
  getEmergencyCardStatus: (...args: unknown[]) => mockGetEmergencyCardStatus(...args),
  resolveEmergencyCard: (...args: unknown[]) => mockResolveEmergencyCard(...args),
}));
jest.mock('@/services/wallet-card.service', () => ({
  shareEmergencyWalletCard: (...args: unknown[]) => mockShareEmergencyWalletCard(...args),
}));
jest.mock('@/services/dynamic-emergency-card.service', () => ({
  buildPrintableEmergencyCardQr: (...args: unknown[]) => mockBuildPrintableEmergencyCardQr(...args),
  createDynamicEmergencyCard: jest.fn(), publishDynamicEmergencyCard: jest.fn(),
  replaceDynamicEmergencyCard: jest.fn(), revokeDynamicEmergencyCard: jest.fn(),
}));
jest.mock('@/components/primary-button', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    PrimaryButton: ({ label, loading, disabled, onPress }: {
      label: string; loading?: boolean; disabled?: boolean; onPress?: () => void;
    }) => <Pressable testID={`mock-${label}`} accessibilityState={{ busy: loading, disabled }} onPress={onPress} disabled={disabled}>
      <Text>{label}</Text>
    </Pressable>,
  };
});

describe('emergency wallet card actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDynamicCard.mockResolvedValue({
      token: 'a'.repeat(43), issuedAt: '2026-09-14T09:00:00Z',
      pendingPublish: false, lastPublishedAt: '2026-09-14T09:05:00Z', lastErrorAt: null,
    });
    mockGetEmergencyCardStatus.mockResolvedValue({ active: true, published_at: '2026-09-14T09:05:00Z' });
    mockResolveEmergencyCard.mockResolvedValue({ qr_payload: 'MEDISCAN:v2:test' });
    mockBuildPrintableEmergencyCardQr.mockResolvedValue({ payload: 'MEDISCAN:v4:test', lastUpdatedAt: '2026-09-14T09:00:00Z' });
  });

  it('loads only the tapped Share button while disabling Replace', async () => {
    let finishShare!: () => void;
    mockShareEmergencyWalletCard.mockImplementation(() => new Promise<void>((resolve) => { finishShare = resolve; }));
    const screen = await render(<EmergencyWalletCardScreen />);
    const share = await screen.findByTestId('Share printable wallet card');
    await fireEvent.press(share);

    await waitFor(() => expect(screen.getByTestId('Share printable wallet card').props.accessibilityState.busy).toBe(true));
    expect(screen.getByTestId('Replace lost or compromised card').props.accessibilityState).toMatchObject({ busy: false, disabled: true });
    expect(screen.getByTestId('Replace lost or compromised card').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('Revoke wallet card').props.accessibilityLabel).toBe('Revoke wallet card');

    finishShare();
    await waitFor(() => expect(screen.getByTestId('Share printable wallet card').props.accessibilityState.busy).toBe(false));
  });

  it('explains when a local printout no longer resolves online', async () => {
    mockResolveEmergencyCard.mockRejectedValue({ status: 404 });
    const screen = await render(<EmergencyWalletCardScreen />);
    expect(await screen.findByText('Online lookup unavailable for this printout')).toBeTruthy();
    expect(screen.getByText('Replace wallet card')).toBeTruthy();
    expect(screen.getByTestId('Share printable wallet card').props.accessibilityState.disabled).toBe(true);
  });
});
