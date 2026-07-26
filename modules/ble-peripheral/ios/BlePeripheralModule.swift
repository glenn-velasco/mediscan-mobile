import CoreBluetooth
import ExpoModulesCore

// Keep in sync with src/lib/ble-gatt-constants.ts — native code can't import
// from src/, so these UUID literals must be updated in both places together.
private let serviceUUID = CBUUID(string: "5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c10")
private let patientIdCharUUID = CBUUID(string: "5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c11")
private let publicKeyCharUUID = CBUUID(string: "5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c12")
private let envelopeWriteCharUUID = CBUUID(string: "5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c13")
private let envelopeAckCharUUID = CBUUID(string: "5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c14")

public class BlePeripheralModule: Module, CBPeripheralManagerDelegate {
  private var manager: CBPeripheralManager?
  private var envelopeWriteChar: CBMutableCharacteristic?
  private var envelopeAckChar: CBMutableCharacteristic?
  private var connectedCentral: CBCentral?

  private var pendingStart: (patientId: String, publicKeyBase64: String, promise: Promise)?
  private var startPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("BlePeripheral")

    Events("onEnvelopeChunkReceived", "onCentralConnected", "onCentralDisconnected")

    AsyncFunction("startAdvertising") { (patientId: String, publicKeyBase64: String, promise: Promise) in
      if self.manager?.state == .poweredOn {
        self.beginAdvertising(patientId: patientId, publicKeyBase64: publicKeyBase64, promise: promise)
        return
      }
      // Not powered on yet (or manager doesn't exist yet) — stash the request and let
      // peripheralManagerDidUpdateState start advertising once the radio is ready.
      self.pendingStart = (patientId, publicKeyBase64, promise)
      if self.manager == nil {
        self.manager = CBPeripheralManager(delegate: self, queue: nil)
      }
    }

    AsyncFunction("stopAdvertising") { (promise: Promise) in
      self.manager?.stopAdvertising()
      self.manager?.removeAllServices()
      self.connectedCentral = nil
      promise.resolve()
    }

    AsyncFunction("sendAck") { (payload: String, promise: Promise) in
      guard let ackChar = self.envelopeAckChar, let data = payload.data(using: .utf8) else {
        promise.reject("ERR_NOT_ADVERTISING", "Cannot send ack: peripheral is not advertising")
        return
      }
      let sent = self.manager?.updateValue(data, for: ackChar, onSubscribedCentrals: nil) ?? false
      if sent {
        promise.resolve()
      } else {
        // Queue is full; CBPeripheralManagerDelegate's peripheralManagerIsReady(toUpdateSubscribers:)
        // callback would be needed to retry — acceptable to surface as a failure for v1 given ack
        // payloads are small (single chunk) and this is the rare case of a saturated transmit queue.
        promise.reject("ERR_SEND_FAILED", "Failed to queue ack notification")
      }
    }

    OnDestroy {
      self.manager?.stopAdvertising()
      self.manager?.removeAllServices()
    }
  }

  private func beginAdvertising(patientId: String, publicKeyBase64: String, promise: Promise) {
    guard let manager = manager else {
      promise.reject("ERR_BLUETOOTH_UNAVAILABLE", "Bluetooth peripheral manager unavailable")
      return
    }

    let patientIdChar = CBMutableCharacteristic(
      type: patientIdCharUUID,
      properties: [.read],
      value: patientId.data(using: .utf8),
      permissions: [.readable]
    )
    let publicKeyChar = CBMutableCharacteristic(
      type: publicKeyCharUUID,
      properties: [.read],
      value: publicKeyBase64.data(using: .utf8),
      permissions: [.readable]
    )
    let writeChar = CBMutableCharacteristic(
      type: envelopeWriteCharUUID,
      properties: [.write, .writeWithoutResponse],
      value: nil,
      permissions: [.writeable]
    )
    let ackChar = CBMutableCharacteristic(
      type: envelopeAckCharUUID,
      properties: [.notify, .read],
      value: nil,
      permissions: [.readable]
    )
    self.envelopeWriteChar = writeChar
    self.envelopeAckChar = ackChar

    let service = CBMutableService(type: serviceUUID, primary: true)
    service.characteristics = [patientIdChar, publicKeyChar, writeChar, ackChar]

    manager.removeAllServices()
    NSLog("[BlePeripheral] adding GATT service %@", serviceUUID.UUIDString)
    manager.add(service)
    NSLog("[BlePeripheral] starting advertising with service %@", serviceUUID.UUIDString)
    manager.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
    ])

    self.startPromise = promise
  }

  // MARK: - CBPeripheralManagerDelegate

  public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard peripheral.state == .poweredOn, let pending = pendingStart else { return }
    pendingStart = nil
    beginAdvertising(patientId: pending.patientId, publicKeyBase64: pending.publicKeyBase64, promise: pending.promise)
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    if let error = error {
      NSLog("[BlePeripheral] FAILED to add service: %@", error.localizedDescription)
    } else {
      NSLog("[BlePeripheral] service added successfully")
    }
    guard let promise = startPromise else { return }
    startPromise = nil
    if let error = error {
      promise.reject("ERR_ADD_SERVICE", error.localizedDescription)
    } else {
      promise.resolve()
    }
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
    connectedCentral = central
    sendEvent("onCentralConnected", ["centralId": central.identifier.uuidString])
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
    if connectedCentral?.identifier == central.identifier {
      connectedCentral = nil
    }
    sendEvent("onCentralDisconnected", ["centralId": central.identifier.uuidString])
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    for request in requests {
      guard request.characteristic.uuid == envelopeWriteCharUUID,
            let data = request.value,
            let chunk = String(data: data, encoding: .utf8) else {
        peripheral.respond(to: request, withResult: .requestNotSupported)
        continue
      }
      connectedCentral = request.central
      sendEvent("onEnvelopeChunkReceived", ["chunk": chunk])
      peripheral.respond(to: request, withResult: .success)
    }
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    // patient_id/public_key are static values already set on the characteristic
    // at construction time — CoreBluetooth serves reads of those automatically.
    // This delegate method only fires for reads CoreBluetooth can't answer itself
    // (shouldn't happen for our fixed-value characteristics), so decline them.
    peripheral.respond(to: request, withResult: .requestNotSupported)
  }
}
