import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

let cachedDeviceName: string | undefined;

export async function getDeviceName(): Promise<string> {
  if (cachedDeviceName) return cachedDeviceName;

  const model = Device.modelName ?? 'Unknown device';
  const identifier =
    Platform.OS === 'android'
      ? Application.getAndroidId()
      : Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : null;

  cachedDeviceName = `${model} (${identifier ?? Application.applicationId ?? 'unknown'})`;
  return cachedDeviceName;
}
