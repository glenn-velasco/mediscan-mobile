/**
 * Fixed, app-wide BLE GATT service used for Scenario 1 (both devices present)
 * proximity sync. The patient device advertises this service via the custom
 * `ble-peripheral` native module; the professional device scans/connects for
 * it via `react-native-ble-plx`.
 *
 * These UUIDs are the single source of truth for this app. They are
 * duplicated as literals in modules/ble-peripheral/ios/BlePeripheralModule.swift
 * and modules/ble-peripheral/android/.../BlePeripheralModule.kt because native
 * code can't import from src/ — keep all three in sync if these ever change.
 */
export const BLE_SERVICE_UUID = '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c10';

export const BLE_CHARACTERISTIC_UUIDS = {
  /** Read-only. Opaque patient id, so the central can confirm it connected to the intended patient after QR-scanning them. */
  patientId: '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c11',
  /** Read-only. Base64 sealed-box public key — the same value the relay endpoint returns, mirrored locally so BLE mode needs no network round-trip. */
  publicKey: '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c12',
  /** Write-only. Chunked, length-prefixed sealed envelope (see src/lib/ble-chunking.ts). */
  envelopeWrite: '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c13',
  /** Notify. Patient signals merge success/failure after a complete envelope is reassembled and processed locally. */
  envelopeAck: '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c14',
} as const;
