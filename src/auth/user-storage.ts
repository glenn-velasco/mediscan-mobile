import AsyncStorage from '@react-native-async-storage/async-storage';

import type { User } from '@/api/types';

const USER_CACHE_KEY = 'mediscan_user_cache';

let cachedUser: User | null | undefined;

export async function saveUser(user: User): Promise<void> {
  cachedUser = user;
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<User | null> {
  if (cachedUser !== undefined) return cachedUser;
  const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
  if (!raw) {
    cachedUser = null;
    return null;
  }
  try {
    cachedUser = JSON.parse(raw) as User;
    return cachedUser;
  } catch {
    cachedUser = null;
    return null;
  }
}

export async function clearUser(): Promise<void> {
  cachedUser = null;
  await AsyncStorage.removeItem(USER_CACHE_KEY);
}
