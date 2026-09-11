package expo.modules.bledisconnect

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "BleDisconnect"

class BleDisconnectModule : Module() {
  override fun definition() = ModuleDefinition {
    Name(TAG)

    AsyncFunction("disconnectAll") {
      val adapter = BluetoothAdapter.getDefaultAdapter() ?: return@AsyncFunction 0
      if (!adapter.isEnabled) return@AsyncFunction 0

      val bondedDevices = adapter.bondedDevices ?: return@AsyncFunction 0
      var count = 0
      for (device in bondedDevices) {
        try {
          val method = device.javaClass.getMethod("disconnect")
          method.invoke(device)
          count++
        } catch (_: Exception) {
          // Device doesn't support disconnect() or already disconnected
        }
      }
      count
    }
  }
}
