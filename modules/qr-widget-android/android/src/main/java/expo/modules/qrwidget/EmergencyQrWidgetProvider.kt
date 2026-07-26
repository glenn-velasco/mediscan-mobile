package expo.modules.qrwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class EmergencyQrWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val bitmap = QrImageStore.loadBitmap(context)

    for (appWidgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.emergency_qr_widget)

      if (bitmap != null) {
        views.setImageViewBitmap(R.id.qr_image, bitmap)
      } else {
        // No QR generated yet (fresh install, cleared cache, or widget added before the app ran).
        views.setImageViewResource(R.id.qr_image, android.R.drawable.ic_menu_camera)
      }

      // Tapping the widget goes straight to the full-screen QR, which also works from the
      // lock screen without a passcode.
      val pendingIntent = PendingIntent.getActivity(
        context,
        1,
        Intent(context, EmergencyQrActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(R.id.qr_image, pendingIntent)

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }
}
