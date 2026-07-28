import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'qr_widget_enabled';

type QrWidgetToggleState = {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

export const useQrWidgetToggleStore = create<QrWidgetToggleState>((set, get) => ({
  enabled: false,
  loaded: false,
  setEnabled: async (value: boolean) => {
    set({ enabled: value });
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  },
  hydrate: async () => {
    if (hydrating) return hydrating;
    hydrating = AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      // Don't overwrite if user already picked a value while hydrating
      if (!get().loaded) {
        set({ enabled: value === 'true', loaded: true });
      }
    });
    return hydrating;
  },
}));

// Auto-hydrate on first import
void useQrWidgetToggleStore.getState().hydrate();
