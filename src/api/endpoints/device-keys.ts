import { invokeFunction } from '@/api/supabase';
import type { DeviceKey, DeviceKeyPayload } from '@/api/types';

export function registerDeviceKey(payload: DeviceKeyPayload) {
  return invokeFunction<DeviceKey>('device-key-register', payload);
}

export function revokeDeviceKey(id: string | number) {
  return invokeFunction<null>('device-key-revoke', { id });
}
