import { apiClient } from '@/api/client';
import type { DeviceKey, DeviceKeyPayload } from '@/api/types';

export function registerDeviceKey(payload: DeviceKeyPayload) {
  return apiClient.post<DeviceKey>('api/v1/device-keys', payload);
}

export function revokeDeviceKey(id: number) {
  return apiClient.delete<null>(`api/v1/device-keys/${id}`);
}
