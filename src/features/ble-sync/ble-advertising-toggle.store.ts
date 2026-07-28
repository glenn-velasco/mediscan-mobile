import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'ble_advertising_enabled';

type BleAdvertisingToggleState = {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

export const useBleAdvertisingToggleStore = create<BleAdvertisingToggleState>((set, get) => ({
  enabled: false,
  loaded: false,
  setEnabled: async (value: boolean) => {
    set({ enabled: value });
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  },
  hydrate: async () => {
    if (hydrating) return hydrating;
    hydrating = AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!get().loaded) {
        set({ enabled: value === 'true', loaded: true });
      }
    });
    return hydrating;
  },
}));

// Auto-hydrate on first import
void useBleAdvertisingToggleStore.getState().hydrate();
