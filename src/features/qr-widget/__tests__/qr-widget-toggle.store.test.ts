import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const STORAGE_KEY = 'qr_widget_enabled';

/**
 * The store holds `enabled`/`loaded` in module scope, so each case needs a fresh registry or state
 * leaks between tests. Safe to isolate here because the store imports no React.
 */
function loadStore() {
  let store!: typeof import('@/features/qr-widget/qr-widget-toggle.store');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('@/features/qr-widget/qr-widget-toggle.store');
  });
  return store;
}

describe('qr-widget-toggle.store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts disabled and unloaded before anything reads storage', () => {
    const store = loadStore();
    const state = store.useQrWidgetToggleStore.getState();

    expect(state.enabled).toBe(false);
    expect(state.loaded).toBe(false);
  });

  it('hydrates the persisted choice and marks itself loaded', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    const store = loadStore();

    await store.useQrWidgetToggleStore.getState().hydrate();

    const state = store.useQrWidgetToggleStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.loaded).toBe(true);
  });

  it('treats absent storage as disabled, but still loaded', async () => {
    const store = loadStore();

    await store.useQrWidgetToggleStore.getState().hydrate();

    const state = store.useQrWidgetToggleStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.loaded).toBe(true);
  });

  it('reads storage only once no matter how many callers subscribe', async () => {
    const store = loadStore();

    const hydrate = store.useQrWidgetToggleStore.getState().hydrate;
    // Every caller reuses the same in-flight read rather than hitting storage again.
    expect(hydrate()).toBe(hydrate());
    await hydrate();
  });

  /**
   * `subscribe()` kicks off the storage read asynchronously, so a user can flip the switch before
   * it resolves. The late read must not overwrite the choice they just made — otherwise enabling
   * the widget silently reverts itself.
   */
  it('keeps a choice made while the storage read is still in flight', async () => {
    const store = loadStore();

    // starts hydrate(), deliberately not awaited
    void store.useQrWidgetToggleStore.getState().hydrate();
    await store.useQrWidgetToggleStore.getState().setEnabled(true);
    await store.useQrWidgetToggleStore.getState().hydrate();

    const state = store.useQrWidgetToggleStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.loaded).toBe(true);
  });

  /**
   * The bug this guards: the Account screen's switch and the Home screen's `useQrWidget` are
   * separate callers. Unless a change notifies *every* subscriber, enabling the widget never
   * reaches the code that posts the notification.
   */
  it('notifies every subscriber when the value changes', async () => {
    const store = loadStore();
    const account = jest.fn();
    const home = jest.fn();
    store.useQrWidgetToggleStore.subscribe(account);
    store.useQrWidgetToggleStore.subscribe(home);

    await store.useQrWidgetToggleStore.getState().setEnabled(true);

    expect(account).toHaveBeenCalled();
    expect(home).toHaveBeenCalled();
    expect(store.useQrWidgetToggleStore.getState().enabled).toBe(true);
  });

  it('persists the value so the choice survives a restart', async () => {
    const store = loadStore();

    await store.useQrWidgetToggleStore.getState().setEnabled(true);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('true');

    await store.useQrWidgetToggleStore.getState().setEnabled(false);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('stops notifying a caller once it unsubscribes', async () => {
    const store = loadStore();
    const listener = jest.fn();
    const unsubscribe = store.useQrWidgetToggleStore.subscribe(listener);
    listener.mockClear();

    unsubscribe();
    await store.useQrWidgetToggleStore.getState().setEnabled(true);

    expect(listener).not.toHaveBeenCalled();
  });
});
