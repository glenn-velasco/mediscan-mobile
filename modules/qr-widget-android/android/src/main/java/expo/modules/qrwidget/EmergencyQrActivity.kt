package expo.modules.qrwidget

import android.app.Activity
import android.graphics.drawable.BitmapDrawable
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView

/**
 * Emergency QR shown as a modal *over* the lock screen, so a first responder can scan it without
 * the passcode.
 *
 * A notification can't do this job: its collapsed layout caps the image at a ~48dp large-icon slot,
 * and the keyguard refuses to expand it while locked. `showWhenLocked` is the standard Android
 * mechanism for this (the same one alarms and incoming calls use).
 *
 * Note the deliberate absence of `KeyguardManager.requestDismissKeyguard` — that would prompt for
 * the passcode, which is precisely what this screen exists to avoid.
 */
class EmergencyQrActivity : Activity() {

  /** Fraction of the screen's shorter edge the code should occupy — big enough to scan, small
   *  enough to still read as a modal. */
  private val qrScreenFraction = 0.55f

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    showOverKeyguard()
    keepScreenLitForScanning()

    setContentView(R.layout.emergency_qr_modal)

    val image = findViewById<ImageView>(R.id.qr_fullscreen_image)
    val empty = findViewById<TextView>(R.id.qr_fullscreen_empty)
    val bitmap = QrImageStore.loadBitmap(this)

    if (bitmap == null) {
      // Never leave a blank white card — say why it's empty.
      image.visibility = View.GONE
      empty.visibility = View.VISIBLE
      return
    }

    sizeToScreen(image)

    // A QR is hard-edged binary data, so let it scale with nearest-neighbour rather than
    // smoothing the module boundaries a scanner needs to read.
    val drawable = BitmapDrawable(resources, bitmap).apply { isFilterBitmap = false }
    image.setImageDrawable(drawable)
  }

  /** The fixed dp in the layout would be tiny on a tablet and overflow a small phone, so scale
   *  the code to the display instead. */
  private fun sizeToScreen(image: ImageView) {
    val metrics = resources.displayMetrics
    val side = (minOf(metrics.widthPixels, metrics.heightPixels) * qrScreenFraction).toInt()
    image.layoutParams = image.layoutParams.apply {
      width = side
      height = side
    }
  }

  private fun showOverKeyguard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
  }

  /** Full brightness and no sleeping, so a camera can actually read the code. */
  private fun keepScreenLitForScanning() {
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    window.attributes = window.attributes.apply {
      screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
    }
  }
}
