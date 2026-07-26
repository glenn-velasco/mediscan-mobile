import AsyncStorage from '@react-native-async-storage/async-storage';

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

export type NotificationsState = { items: AppNotification[]; loaded: boolean };

/**
 * Shared, app-wide in-app notification inbox — deliberately kept free of React, same shape as
 * qr-widget-toggle.store.ts. The bell badge (Home header) and the notifications list screen both
 * read this, and pushing a notification from anywhere (e.g. the realtime event handlers) needs to
 * reach both instantly, which per-instance state can't do.
 */
let state: NotificationsState = { items: [], loaded: false };
const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

async function persist(items: AppNotification[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
    const items: AppNotification[] = raw ? JSON.parse(raw) : [];
    state = { items, loaded: true };
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

export function getSnapshot(): NotificationsState {
  return state;
}

export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  await hydrate();
  const item: AppNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    read: false,
  };
  const items = [item, ...state.items].slice(0, MAX_STORED);
  state = { ...state, items };
  emit();
  await persist(items);
}

export async function markAllRead(): Promise<void> {
  await hydrate();
  if (state.items.every((n) => n.read)) return;
  const items = state.items.map((n) => (n.read ? n : { ...n, read: true }));
  state = { ...state, items };
  emit();
  await persist(items);
}

/** Marks a single notification read — used when the user actually opens/taps it, so the badge only drops by one instead of the whole inbox clearing at once. */
export async function markRead(id: string): Promise<void> {
  await hydrate();
  const target = state.items.find((n) => n.id === id);
  if (!target || target.read) return;
  const items = state.items.map((n) => (n.id === id ? { ...n, read: true } : n));
  state = { ...state, items };
  emit();
  await persist(items);
}

export async function clearNotifications(): Promise<void> {
  state = { ...state, items: [] };
  emit();
  await persist([]);
}
