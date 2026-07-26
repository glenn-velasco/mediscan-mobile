package expo.modules.blelocation

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "BleLocation"
private const val REQUEST_CHECK_LOCATION_SETTINGS = 5813

class BleLocationModule : Module() {
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
    val locationRequest = LocationRequest.Builder(10000L)
      .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
      .build()
    val settingsRequest = LocationSettingsRequest.Builder().addLocationRequest(locationRequest).build()

    LocationServices.getSettingsClient(context)
      .checkLocationSettings(settingsRequest)
      .addOnSuccessListener { promise.resolve(true) }
      .addOnFailureListener { exception -> handleFailure(exception, promise) }
  }

  private fun handleFailure(exception: Exception, promise: Promise) {
    val activity = appContext.currentActivity
    val reactContext = appContext.reactContext as? ReactApplicationContext

    if (exception !is ResolvableApiException || activity == null || reactContext == null) {
      promise.resolve(false)
      return
    }
    if ((exception as? ApiException)?.statusCode != com.google.android.gms.location.LocationSettingsStatusCodes.RESOLUTION_REQUIRED) {
      promise.resolve(false)
      return
    }

    pendingPromise = promise
    attachActivityListener(reactContext)

    try {
      activity.startIntentSenderForResult(
        exception.resolution.intentSender,
        REQUEST_CHECK_LOCATION_SETTINGS,
        null,
        0,
        0,
        0,
      )
    } catch (sendException: Exception) {
      detachActivityListener()
      pendingPromise = null
      promise.resolve(false)
    }
  }

  private fun attachActivityListener(reactContext: ReactApplicationContext) {
    val listener = object : ActivityEventListener {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CHECK_LOCATION_SETTINGS) return
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
