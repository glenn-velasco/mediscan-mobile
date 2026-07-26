import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useQrWidgetToggle } from '@/features/qr-widget/useQrWidgetToggle';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useQrWidgetToggle', () => {
  /**
   * The regression this guards: the switch lives on the Account screen while the code that
   * generates the QR and posts the widget/notification (`useQrWidget`) is mounted on the Home
   * screen, which stays mounted underneath it. With per-instance `useState` the Home copy never
   * saw the toggle change, so enabling the widget did nothing until a full app restart.
   */
  it('lets one caller see a change made by another', async () => {
    const account = await renderHook(() => useQrWidgetToggle());
    const home = await renderHook(() => useQrWidgetToggle());

    await waitFor(() => expect(home.result.current.loaded).toBe(true));

    await act(async () => {
      await account.result.current.setEnabled(true);
    });
    expect(account.result.current.enabled).toBe(true);
    expect(home.result.current.enabled).toBe(true);

    // ...and back off again, which is what tears the notification down.
    await act(async () => {
      await account.result.current.setEnabled(false);
    });
    expect(home.result.current.enabled).toBe(false);
  });

  it('stops updating a caller once it unmounts', async () => {
    const survivor = await renderHook(() => useQrWidgetToggle());
    const leaver = await renderHook(() => useQrWidgetToggle());
    await waitFor(() => expect(survivor.result.current.loaded).toBe(true));

    await act(async () => {
      await survivor.result.current.setEnabled(false);
    });

    leaver.unmount();

    await act(async () => {
      await survivor.result.current.setEnabled(true);
    });

    expect(survivor.result.current.enabled).toBe(true);
    expect(leaver.result.current.enabled).toBe(false); // frozen at its last mounted value
  });
});
