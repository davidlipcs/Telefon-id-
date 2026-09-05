package hu.kredit

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView

/**
 * A "nincs több játékidő" panel. A rendszer fölé rajzol, ezért kell hozzá a
 * "Más appok fölé rajzolás" engedély. Ha az nincs megadva, a figyelő akkor is
 * kiteszi az appot az előtérből, csak nem tudja megmondani, miért.
 */
class BlockOverlay(private val ctx: Context) {

    private val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val handler = Handler(Looper.getMainLooper())
    private var view: View? = null
    private val autoHide = Runnable { hide() }

    fun granted(): Boolean = Settings.canDrawOverlays(ctx)

    fun show() {
        if (view != null || !granted()) return

        val v = LayoutInflater.from(ctx).inflate(R.layout.overlay_block, null)
        v.findViewById<TextView>(R.id.blockBody).text =
            if (!Store.dayStarted(ctx))
                ctx.getString(R.string.block_body_no_day)
            else
                ctx.getString(R.string.block_body)

        v.findViewById<View>(R.id.blockOk).setOnClickListener { hide() }
        v.findViewById<View>(R.id.blockStudy).setOnClickListener {
            hide()
            ctx.startActivity(
                Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        )
        runCatching { wm.addView(v, lp) }.onSuccess { view = v }
        // Biztonsági háló: a panel soha ne ragadjon a képernyőn.
        handler.postDelayed(autoHide, 30_000L)
    }

    fun hide() {
        handler.removeCallbacks(autoHide)
        view?.let { v -> runCatching { wm.removeView(v) } }
        view = null
    }
}
