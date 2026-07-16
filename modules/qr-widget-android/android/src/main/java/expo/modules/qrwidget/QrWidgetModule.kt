package expo.modules.qrwidget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QrWidgetModule : Module() {
  private val legacyChannelId = "emergency-qr"
  // A new channel id is required: NotificationChannel importance / bypassDnd /
  // lockscreenVisibility are locked after first creation, and the legacy channel
  // was created without DND bypass or public lockscreen visibility.
  private val channelId = "emergency-qr.v2"
  private val notificationId = 1001

  override fun definition() = ModuleDefinition {
    Name("QrWidget")

    AsyncFunction("saveQrImage") { path: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      QrImageStore.savePath(context, path)
      val intent = Intent(context, EmergencyQrWidgetProvider::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
      }
      val ids = AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, EmergencyQrWidgetProvider::class.java))
      intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      context.sendBroadcast(intent)
      null
    }

    AsyncFunction("showQrNotification") { imagePath: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null

      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      // NotificationChannel only exists on API 26+ (Android 8.0). On Android 7.x
      // notifications are posted without a channel, so guard the creation.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Remove the stale channel whose locked settings couldn't bypass DND.
        manager.deleteNotificationChannel(legacyChannelId)

        val channel = NotificationChannel(
          channelId,
          "Emergency QR Code",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          setShowBadge(true)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          // bypassDnd only sticks if the app holds notification-policy access;
          // re-applied on every post so it takes effect once access is granted.
          setBypassDnd(manager.isNotificationPolicyAccessGranted)
        }
        manager.createNotificationChannel(channel)
      }

      val bitmap = QrImageStore.decode(imagePath)

      // Opens the full-screen QR over the keyguard. The notification's own layouts can't do the
      // job: collapsed caps the image at a ~48dp large-icon slot, and the keyguard won't expand
      // it while locked. Request code 1 keeps this distinct from the widget's PendingIntent.
      val qrPendingIntent = PendingIntent.getActivity(
        context,
        1,
        Intent(context, EmergencyQrActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val builder = NotificationCompat.Builder(context, channelId)
        .setContentTitle("Emergency QR Code")
        .setContentText("First responders can scan this")
        .setSmallIcon(android.R.drawable.ic_menu_camera)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(false)
        .setContentIntent(qrPendingIntent)
        .addAction(0, context.getString(R.string.qr_show_action), qrPendingIntent)

      if (bitmap != null) {
        // The square code is a legible thumbnail cue; the letterboxed copy keeps the wide
        // expanded picture area from stretching or cropping it once unlocked.
        builder.setLargeIcon(bitmap)
        builder.setStyle(
          NotificationCompat.BigPictureStyle()
            .bigPicture(letterboxForNotification(bitmap))
            .bigLargeIcon(null as Bitmap?)
        )
      }

      manager.notify(notificationId, builder.build())
      null
    }

    AsyncFunction("hideQrNotification") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.cancel(notificationId)
      null
    }

    AsyncFunction("hasDndBypassAccess") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.isNotificationPolicyAccessGranted
    }

    AsyncFunction("openDndBypassSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      try {
        val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      } catch (_: Exception) {
        // Some OEMs don't expose this screen; nothing else we can do here.
      }
      null
    }
  }

  /** Centers the square QR on a 2:1 white canvas so the notification's wide picture
   *  area scales it without stretching or clipping the code, on any device. */
  private fun letterboxForNotification(src: Bitmap): Bitmap {
    val height = src.height
    val width = height * 2
    val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(result)
    canvas.drawColor(Color.WHITE)
    canvas.drawBitmap(src, ((width - src.width) / 2).toFloat(), 0f, null)
    return result
  }
}
