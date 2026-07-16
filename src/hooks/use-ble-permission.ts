import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * iOS has no manual request API for Bluetooth — the system prompt fires automatically the first
 * time CBCentralManager/CBPeripheralManager is used, driven by the NSBluetoothAlwaysUsageDescription
 * Info.plist entry (react-native-ble-plx's config plugin). Only Android needs an explicit runtime
 * request, and which permissions depends on API level (BLUETOOTH_SCAN/CONNECT/ADVERTISE on 31+,
 * ACCESS_FINE_LOCATION pre-31 for scanning).
 */
export type BlePermissionStatus = { granted: boolean };

async function requestAndroidPermissions(
  permissions: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][],
): Promise<boolean> {
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

/** Permissions needed for the professional-side central (scan/connect) role. */
export function useBleCentralPermission(): [BlePermissionStatus | null, () => Promise<boolean>] {
  const [status, setStatus] = useState<BlePermissionStatus | null>(null);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatus({ granted: true });
      return true;
    }
    const permissions =
      Platform.Version >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const granted = await requestAndroidPermissions(permissions);
    setStatus({ granted });
    return granted;
  }, []);

  return [status, requestPermission];
}

/** Permissions needed for the patient-side peripheral (advertise) role. */
export function useBlePeripheralPermission(): [BlePermissionStatus | null, () => Promise<boolean>] {
  const [status, setStatus] = useState<BlePermissionStatus | null>(null);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || Platform.Version < 31) {
      setStatus({ granted: true });
      return true;
    }
    const granted = await requestAndroidPermissions([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    setStatus({ granted });
    return granted;
  }, []);

  return [status, requestPermission];
}
