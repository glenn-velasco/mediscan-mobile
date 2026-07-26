package expo.modules.bleperipheral

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.Build
import android.util.Log
import android.os.ParcelUuid
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

// Keep in sync with src/lib/ble-gatt-constants.ts — native code can't import
// from src/, so these UUID literals must be updated in both places together.
private val SERVICE_UUID: UUID = UUID.fromString("5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c10")
private val PATIENT_ID_CHAR_UUID: UUID = UUID.fromString("5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c11")
private val PUBLIC_KEY_CHAR_UUID: UUID = UUID.fromString("5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c12")
private val ENVELOPE_WRITE_CHAR_UUID: UUID = UUID.fromString("5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c13")
private val ENVELOPE_ACK_CHAR_UUID: UUID = UUID.fromString("5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c14")
private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
private const val TAG = "BlePeripheral"

class BlePeripheralModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  private var gattServer: BluetoothGattServer? = null
  private var advertiser: BluetoothLeAdvertiser? = null
  private var envelopeAckChar: BluetoothGattCharacteristic? = null
  private var connectedDevice: BluetoothDevice? = null
  private var notificationsEnabled = false

  override fun definition() = ModuleDefinition {
    Name("BlePeripheral")

    Events("onEnvelopeChunkReceived", "onCentralConnected", "onCentralDisconnected")

    AsyncFunction("startAdvertising") { patientId: String, publicKeyBase64: String, promise: Promise ->
      startAdvertising(patientId, publicKeyBase64, promise)
    }

    AsyncFunction("stopAdvertising") { promise: Promise ->
      stopAdvertising(promise)
    }

    AsyncFunction("sendAck") { payload: String, promise: Promise ->
      sendAck(payload, promise)
    }

    OnDestroy { teardownInternal() }
  }

  @SuppressLint("MissingPermission")
  private fun startAdvertising(patientId: String, publicKeyBase64: String, promise: Promise) {
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    val adapter = bluetoothManager?.adapter
    if (bluetoothManager == null || adapter == null || !adapter.isEnabled) {
      promise.reject("ERR_BLUETOOTH_UNAVAILABLE", "Bluetooth is unavailable or disabled", null)
      return
    }

    teardownInternal()

    val server = bluetoothManager.openGattServer(context, gattServerCallback)
    if (server == null) {
      promise.reject("ERR_GATT_SERVER", "Failed to open GATT server", null)
      return
    }
    gattServer = server

    val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

    val patientIdChar = BluetoothGattCharacteristic(
      PATIENT_ID_CHAR_UUID,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ
    ).apply { value = patientId.toByteArray(Charsets.UTF_8) }

    val publicKeyChar = BluetoothGattCharacteristic(
      PUBLIC_KEY_CHAR_UUID,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ
    ).apply { value = publicKeyBase64.toByteArray(Charsets.UTF_8) }

    val writeChar = BluetoothGattCharacteristic(
      ENVELOPE_WRITE_CHAR_UUID,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE
    )

    val ackChar = BluetoothGattCharacteristic(
      ENVELOPE_ACK_CHAR_UUID,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ
    ).apply {
      addDescriptor(
        BluetoothGattDescriptor(
          CCCD_UUID,
          BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
        )
      )
    }
    envelopeAckChar = ackChar

    service.addCharacteristic(patientIdChar)
    service.addCharacteristic(publicKeyChar)
    service.addCharacteristic(writeChar)
    service.addCharacteristic(ackChar)

    val added = gattServer?.addService(service)
    Log.i(TAG, "addService returned: $added")
    if (added != true) {
      Log.e(TAG, "addService FAILED — GATT server may be null or closed")
    }

    Log.i(TAG, "starting advertising with service $SERVICE_UUID")
    val bleAdvertiser = adapter.bluetoothLeAdvertiser
    if (bleAdvertiser == null) {
      promise.reject("ERR_ADVERTISER_UNAVAILABLE", "Device does not support BLE advertising", null)
      return
    }
    advertiser = bleAdvertiser

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
      .setConnectable(true)
      .build()

    val advertiseData = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(SERVICE_UUID))
      .build()

    bleAdvertiser.startAdvertising(settings, advertiseData, advertiseCallback(promise))
  }

  @SuppressLint("MissingPermission")
  private fun stopAdvertising(promise: Promise) {
    teardownInternal()
    promise.resolve(null)
  }

  @SuppressLint("MissingPermission")
  private fun sendAck(payload: String, promise: Promise) {
    val server = gattServer
    val char = envelopeAckChar
    val device = connectedDevice
    if (server == null || char == null || device == null || !notificationsEnabled) {
      promise.reject("ERR_NOT_ADVERTISING", "Cannot send ack: no subscribed central connected", null)
      return
    }
    val bytes = payload.toByteArray(Charsets.UTF_8)
    char.value = bytes
    val sent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      server.notifyCharacteristicChanged(device, char, false, bytes) == BluetoothStatusCodes.SUCCESS
    } else {
      @Suppress("DEPRECATION")
      server.notifyCharacteristicChanged(device, char, false)
    }
    if (sent) {
      promise.resolve(null)
    } else {
      promise.reject("ERR_SEND_FAILED", "Failed to send ack notification", null)
    }
  }

  @SuppressLint("MissingPermission")
  private fun teardownInternal() {
    advertiser?.stopAdvertising(noopAdvertiseCallback)
    gattServer?.close()
    gattServer = null
    advertiser = null
    envelopeAckChar = null
    connectedDevice = null
    notificationsEnabled = false
  }

  private fun advertiseCallback(promise: Promise) = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
      Log.i(TAG, "advertising started successfully")
      promise.resolve(null)
    }

    override fun onStartFailure(errorCode: Int) {
      Log.e(TAG, "advertising failed with error code $errorCode")
      promise.reject("ERR_ADVERTISE_FAILED", "startAdvertising failed with error code $errorCode", null)
    }
  }

  private val noopAdvertiseCallback = object : AdvertiseCallback() {}

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    @SuppressLint("MissingPermission")
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      when (newState) {
        BluetoothProfile.STATE_CONNECTED -> {
          connectedDevice = device
          sendEvent("onCentralConnected", mapOf("centralId" to device.address))
        }
        BluetoothProfile.STATE_DISCONNECTED -> {
          if (connectedDevice?.address == device.address) {
            connectedDevice = null
            notificationsEnabled = false
          }
          sendEvent("onCentralDisconnected", mapOf("centralId" to device.address))
        }
      }
    }

    @SuppressLint("MissingPermission")
    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray
    ) {
      if (characteristic.uuid == ENVELOPE_WRITE_CHAR_UUID) {
        connectedDevice = device
        sendEvent("onEnvelopeChunkReceived", mapOf("chunk" to String(value, Charsets.UTF_8)))
        if (responseNeeded) {
          gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }
      } else if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
      }
    }

    @SuppressLint("MissingPermission")
    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic
    ) {
      val value = characteristic.value
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value?.drop(offset)?.toByteArray())
    }

    @SuppressLint("MissingPermission")
    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray
    ) {
      if (descriptor.uuid == CCCD_UUID) {
        notificationsEnabled = value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
      }
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
      }
    }
  }
}
