package expo.modules.bleradio

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "BleRadio"
private const val REQUEST_ENABLE_BLUETOOTH = 5814

/**
 * react-native-ble-plx's BleManager.enable() never shows the system "turn on Bluetooth" dialog on
 * Android 12+: its native module only holds an application Context, and its dialog trigger is
 * gated on `context instanceof Activity`, which is always false there. This module does the same
 * ACTION_REQUEST_ENABLE flow directly against a real Activity (via appContext.currentActivity).
 */
class BleRadioModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  private var pendingPromise: Promise? = null
  private var activityEventListener: ActivityEventListener? = null

  override fun definition() = ModuleDefinition {
    Name(TAG)

    AsyncFunction("ensureEnabled") { promise: Promise ->
      ensureEnabled(promise)
    }

    OnDestroy { detachActivityListener() }
  }

  private fun ensureEnabled(promise: Promise) {
    val adapter = BluetoothAdapter.getDefaultAdapter()
    if (adapter == null) {
      promise.resolve(false)
      return
    }
    if (adapter.isEnabled) {
      promise.resolve(true)
      return
    }

    val activity = appContext.currentActivity
    val reactContext = appContext.reactContext as? ReactApplicationContext
    if (activity == null || reactContext == null) {
      promise.resolve(false)
      return
    }

    pendingPromise = promise
    attachActivityListener(reactContext)

    try {
      activity.startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQUEST_ENABLE_BLUETOOTH)
    } catch (e: Exception) {
      detachActivityListener()
      pendingPromise = null
      promise.resolve(false)
    }
  }

  private fun attachActivityListener(reactContext: ReactApplicationContext) {
    val listener = object : ActivityEventListener {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_ENABLE_BLUETOOTH) return
        val resolved = pendingPromise
        pendingPromise = null
        detachActivityListener()
        resolved?.resolve(resultCode == Activity.RESULT_OK)
      }

      override fun onNewIntent(intent: Intent) {}
    }
    activityEventListener = listener
    reactContext.addActivityEventListener(listener)
  }

  private fun detachActivityListener() {
    val reactContext = appContext.reactContext as? ReactApplicationContext
    activityEventListener?.let { reactContext?.removeActivityEventListener(it) }
    activityEventListener = null
  }
}
