package expo.modules.qrwidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri

/**
 * Single source of truth for the generated emergency-QR image, shared by the widget provider,
 * the notification and the lock-screen activity.
 *
 * The JS side hands over a filesystem path; `BitmapFactory.decodeFile` needs exactly that and
 * silently returns null for a `file://` URI, so normalise here rather than in each caller.
 */
object QrImageStore {
  private const val PREFS_NAME = "qr_widget_prefs"
  private const val IMAGE_PATH_KEY = "qr_image_path"

  fun savePath(context: Context, path: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(IMAGE_PATH_KEY, path)
      .apply()
  }

  /** Returns the current QR bitmap, or null if none has been generated yet. */
  fun loadBitmap(context: Context): Bitmap? {
    val stored = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(IMAGE_PATH_KEY, null) ?: return null

    return decode(stored)
  }

  fun decode(path: String): Bitmap? = try {
    val normalized = if (path.startsWith("file://")) Uri.parse(path).path else path
    BitmapFactory.decodeFile(normalized)
  } catch (_: Exception) {
    null
  }
}
