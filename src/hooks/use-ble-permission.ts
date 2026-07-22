import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

/**
 * iOS has no manual request API for Bluetooth — the system prompt fires automatically the first
 * time CBCentralManager/CBPeripheralManager is used, driven by the NSBluetoothAlwaysUsageDescription
 * Info.plist entry (react-native-ble-plx's config plugin). Only Android needs an explicit runtime
 * request, and which permissions depends on API level (BLUETOOTH_SCAN/CONNECT/ADVERTISE on 31+,
 * ACCESS_FINE_LOCATION pre-31 for scanning).
 */
export type BlePermissionStatus = { granted: boolean };

type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

function getCentralPermissions(): AndroidPermission[] {
  return Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

function getPeripheralPermissions(): AndroidPermission[] {
  return Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [];
}

async function checkAndroidPermissions(permissions: AndroidPermission[]): Promise<boolean> {
  if (permissions.length === 0) return true;
  const results = await Promise.all(permissions.map((permission) => PermissionsAndroid.check(permission)));
  return results.every(Boolean);
}

async function requestAndroidPermissions(permissions: AndroidPermission[]): Promise<boolean> {
  if (permissions.length === 0) return true;
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * Shared Android permission hook: checks current grant status on mount and whenever the app
 * returns to the foreground (so a grant made via system Settings is picked up without an app
 * restart), plus an explicit `requestPermission` for the prompting path used before scan/advertise.
 */
function useAndroidBlePermission(
  getPermissions: () => AndroidPermission[],
): [BlePermissionStatus | null, () => Promise<boolean>] {
  const [status, setStatus] = useState<BlePermissionStatus | null>(null);

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatus({ granted: true });
      return;
    }
    const granted = await checkAndroidPermissions(getPermissions());
    setStatus({ granted });
  }, [getPermissions]);

  useEffect(() => {
    let isMounted = true;
    // checkPermission is async and calls setState in callback, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkPermission().then(() => {
      if (!isMounted) return;
    });
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkPermission();
      }
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [checkPermission]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatus({ granted: true });
      return true;
    }
    const granted = await requestAndroidPermissions(getPermissions());
    setStatus({ granted });
    return granted;
  }, [getPermissions]);

  return [status, requestPermission];
}

/** Permissions needed for the professional-side central (scan/connect) role. */
export function useBleCentralPermission(): [BlePermissionStatus | null, () => Promise<boolean>] {
  return useAndroidBlePermission(getCentralPermissions);
}

/** Permissions needed for the patient-side peripheral (advertise) role. */
export function useBlePeripheralPermission(): [BlePermissionStatus | null, () => Promise<boolean>] {
  return useAndroidBlePermission(getPeripheralPermissions);
}
