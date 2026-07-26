import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ble_advertising_enabled';

export type BleAdvertisingToggleState = { enabled: boolean; loaded: boolean };

/**
 * Shared, app-wide persisted preference for the "Bluetooth sync" switch (see
 * `qr-widget-toggle.store.ts` for the identical pattern this mirrors). Without this the switch's
 * on/off state lived only in `useBleAdvertising`'s component `useState` and the peripheral
 * service's in-memory `advertising` flag — both reset on every cold start, so the user had to
 * re-enable it every time the app reloaded even though they'd turned it on before.
 */
let state: BleAdvertisingToggleState = { enabled: false, loaded: false };
const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;
let chosen = false;

function emit() {
  for (const listener of listeners) listener();
}

export function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = AsyncStorage.getItem(STORAGE_KEY).then((value) => {
    state = { enabled: chosen ? state.enabled : value === 'true', loaded: true };
    emit();
  });
  return hydrating;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void hydrate();
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): BleAdvertisingToggleState {
  return state;
}

export async function setEnabled(value: boolean): Promise<void> {
  chosen = true;
  state = { ...state, enabled: value };
  emit();
  await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
}
