import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'qr_widget_enabled';

export type QrWidgetToggleState = { enabled: boolean; loaded: boolean };

/**
 * Shared, app-wide state for the "Emergency QR Widget" toggle, deliberately kept free of React.
 *
 * The switch lives on the Account screen while the code that generates the QR and posts the
 * widget/notification (`useQrWidget`) is mounted on the Home screen. With per-instance `useState`
 * the two never stayed in sync, so toggling did nothing until a full app restart. Module-level
 * state means every caller observes the same value and updates instantly.
 */
let state: QrWidgetToggleState = { enabled: false, loaded: false };
const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;
/** Set once the user picks a value, so a slow read can't overwrite their choice. */
let chosen = false;

function emit() {
  for (const listener of listeners) listener();
}

/** Reads the persisted choice once; further calls reuse the in-flight/settled promise. */
export function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = AsyncStorage.getItem(STORAGE_KEY).then((value) => {
    // The user can toggle while this read is still in flight; their choice wins.
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

/** Returns a cached object so `useSyncExternalStore` only re-renders on real changes. */
export function getSnapshot(): QrWidgetToggleState {
  return state;
}

export async function setEnabled(value: boolean): Promise<void> {
  chosen = true;
  state = { ...state, enabled: value };
  emit();
  await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
}
