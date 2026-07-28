import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'app_notifications';
const MAX_STORED = 50;

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  /** expo-router href to navigate to when tapped, e.g. `/professional-application/5`. */
  href?: string;
};

type NotificationsState = {
  items: AppNotification[];
  loaded: boolean;
  add: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  hydrate: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  loaded: false,
  hydrate: async () => {
    if (hydrating) return hydrating;
    hydrating = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const items: AppNotification[] = raw ? JSON.parse(raw) : [];
      set({ items, loaded: true });
    });
    return hydrating;
  },
  add: async (notification) => {
    await get().hydrate();
    const item: AppNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      read: false,
    };
    const items = [item, ...get().items].slice(0, MAX_STORED);
    set({ items });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },
  markAllRead: async () => {
    await get().hydrate();
    const { items } = get();
    if (items.every((n) => n.read)) return;
    const updated = items.map((n) => (n.read ? n : { ...n, read: true }));
    set({ items: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
  markRead: async (id: string) => {
    await get().hydrate();
    const { items } = get();
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    const updated = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    set({ items: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
  clearNotifications: async () => {
    set({ items: [] });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  },
}));

// Auto-hydrate on first import
void useNotificationsStore.getState().hydrate();

/** Standalone helper for use outside React components (e.g. event handlers). */
export const addNotification = (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) =>
  useNotificationsStore.getState().add(notification);
