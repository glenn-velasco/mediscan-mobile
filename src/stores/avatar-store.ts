import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInfoAsync, makeDirectoryAsync, readDirectoryAsync, copyAsync, deleteAsync, downloadAsync, documentDirectory } from 'expo-file-system/legacy';

import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { getMedicalInformation } from '@/api/endpoints/medical-information';
import { getCachedToken } from '@/auth/token-storage';
import { getIsOffline, isNetworkStateKnown } from '@/lib/network-state';

const TAG = '[avatar-store]';
const AVATAR_DIR = `${documentDirectory}avatars/`;
const AVATAR_CACHE_KEY = '@avatar_cache';
const AVATAR_PENDING_KEY = '@avatar_pending';

type CachedAvatar = { id: number; url: string | null };
type PendingUpload = { localUri: string; medicalInformationId: number };

// Eagerly load at module level
const cachedDataPromise = AsyncStorage.getItem(AVATAR_CACHE_KEY)
  .then((raw) => raw ? JSON.parse(raw) as CachedAvatar : null)
  .catch(() => null);

const pendingUploadPromise = AsyncStorage.getItem(AVATAR_PENDING_KEY)
  .then((raw) => raw ? JSON.parse(raw) as PendingUpload : null)
  .catch(() => null);

const localAvatarPromise = (async () => {
  try {
    const info = await getInfoAsync(AVATAR_DIR);
    if (!info.exists) return null;
    const files = await readDirectoryAsync(AVATAR_DIR);
    if (files.length === 0) return null;
    return `${AVATAR_DIR}${files.sort().reverse()[0]}`;
  } catch {
    return null;
  }
})();

// Read server_id from local SQLite (instant, no network)
const localDbPromise = medicalInformationRepo.getLocal()
  .then((row) => {
    console.log(TAG, 'local DB:', { server_id: row?.server_id });
    return row;
  })
  .catch(() => null);

async function ensureDir() {
  const info = await getInfoAsync(AVATAR_DIR);
  if (!info.exists) await makeDirectoryAsync(AVATAR_DIR, { intermediates: true });
}

async function copyToLocal(uri: string): Promise<string> {
  await ensureDir();
  const dest = `${AVATAR_DIR}avatar-${Date.now()}.jpg`;

  // Check source exists
  const source = await getInfoAsync(uri);
  console.log(TAG, 'source file:', { uri, exists: source.exists, size: 'size' in source ? (source as any).size : 'unknown' });

  console.log(TAG, 'copying:', { from: uri, to: dest });
  await copyAsync({ from: uri, to: dest });

  // Verify the file was actually written
  const result = await getInfoAsync(dest);
  console.log(TAG, 'dest file:', { exists: result.exists, size: 'size' in result ? (result as any).size : 'unknown' });

  return dest;
}

async function downloadToLocal(url: string): Promise<string> {
  await ensureDir();
  const hash = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
  const dest = `${AVATAR_DIR}remote-${hash}.jpg`;
  const info = await getInfoAsync(dest);
  if (info.exists) return dest;
  console.log(TAG, 'downloading:', url);
  await downloadAsync(url, dest);
  console.log(TAG, 'download done:', dest);
  return dest;
}

type AvatarStore = {
  localUri: string | null;
  serverUrl: string | null;
  medicalInformationId: number | null;
  pendingUpload: PendingUpload | null;
  initialized: boolean;

  init: () => Promise<void>;
  saveLocal: (uri: string) => Promise<string>;
  setPendingUpload: (upload: PendingUpload | null) => void;
  setServerUrl: (url: string | null) => void;
  clear: () => void;
};

export const useAvatarStore = create<AvatarStore>((set, get) => ({
  localUri: null,
  serverUrl: null,
  medicalInformationId: null,
  pendingUpload: null,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });
    console.log(TAG, 'init: loading...');

    // 1. Resolve all local sources in parallel (no network)
    const [cached, pending, localUri, localRow] = await Promise.all([
      cachedDataPromise,
      pendingUploadPromise,
      localAvatarPromise,
      localDbPromise,
    ]);

    // 2. Set medicalInformationId from local DB (primary) or cache (fallback)
    const id = localRow?.server_id ?? cached?.id ?? null;
    if (id) {
      console.log(TAG, 'init: medicalInformationId =', id, '(from', localRow?.server_id ? 'SQLite' : 'cache', ')');
      set({ medicalInformationId: id });
    } else {
      console.warn(TAG, 'init: no medicalInformationId from local DB or cache');
    }

    if (cached?.url) set({ serverUrl: cached.url });
    if (localUri) set({ localUri });
    if (pending) {
      console.log(TAG, 'init: pending upload found', pending);
      set({ pendingUpload: pending, localUri: pending.localUri });
    }

    // 3. Background refresh from server (non-blocking, optional)
    if (!isNetworkStateKnown() || getIsOffline() || !getCachedToken()) {
      console.log(TAG, 'init: skipping server refresh', { known: isNetworkStateKnown(), offline: getIsOffline(), hasToken: !!getCachedToken() });
      return;
    }
    try {
      const data = await getMedicalInformation();
      console.log(TAG, 'init: server refresh', { id: data.id, avatar: data.avatar });
      set({ medicalInformationId: data.id, serverUrl: data.avatar });
      AsyncStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify({ id: data.id, url: data.avatar })).catch(() => {});
    } catch {
      // Offline — local DB already has the ID, server URL will update when back online
      console.log(TAG, 'init: server unreachable, using local data');
    }
  },

  saveLocal: async (uri: string) => {
    console.log(TAG, 'saveLocal:', uri);
    const localUri = await copyToLocal(uri);
    set({ localUri });
    console.log(TAG, 'saveLocal done:', localUri);
    return localUri;
  },

  setPendingUpload: (upload) => {
    console.log(TAG, 'setPendingUpload:', upload);
    set({ pendingUpload: upload });
    if (upload) {
      AsyncStorage.setItem(AVATAR_PENDING_KEY, JSON.stringify(upload)).catch(() => {});
    } else {
      AsyncStorage.removeItem(AVATAR_PENDING_KEY).catch(() => {});
    }
  },

  setServerUrl: (url) => {
    console.log(TAG, 'setServerUrl:', url);
    set({ serverUrl: url, pendingUpload: null });
    const id = get().medicalInformationId;
    if (id) {
      AsyncStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify({ id, url })).catch(() => {});
    }
    AsyncStorage.removeItem(AVATAR_PENDING_KEY).catch(() => {});
  },

  clear: () => {
    const { localUri } = get();
    if (localUri) deleteAsync(localUri, { idempotent: true }).catch(() => {});
    set({ localUri: null, serverUrl: null, pendingUpload: null });
    AsyncStorage.removeItem(AVATAR_CACHE_KEY).catch(() => {});
    AsyncStorage.removeItem(AVATAR_PENDING_KEY).catch(() => {});
  },
}));

// Do NOT auto-initialize — the dashboard (Avatar component) triggers init()
// when the user is actually logged in and viewing the app
