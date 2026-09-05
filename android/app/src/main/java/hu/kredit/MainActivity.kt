package hu.kredit

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * A felület: ugyanaz a kredit.html, ami böngészőben is fut, itt WebView-ban.
 * Fölötte egy csík, amíg a zárolás beállítása nincs kész.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.textZoom = 100
        web.addJavascriptInterface(KreditBridge(this), "KreditNative")
        web.loadUrl("file:///android_asset/kredit.html")
    }

    override fun onResume() {
        super.onResume()
        showSetupIfNeeded()
        // A figyelő közben elhasználhatott perceket; a felület olvassa újra.
        web.evaluateJavascript(
            "if (window.reloadFromNative) window.reloadFromNative();", null
        )
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    /** Sorban egy lépést kér: előbb a figyelőt, aztán a panel engedélyét. */
    private fun showSetupIfNeeded() {
        val banner = findViewById<LinearLayout>(R.id.setupBanner)
        val text = findViewById<TextView>(R.id.setupText)
        val button = findViewById<Button>(R.id.setupButton)

        when {
            !guardEnabled(this) -> {
                text.text = getString(R.string.setup_guard)
                button.text = getString(R.string.setup_guard_button)
                button.setOnClickListener {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                }
                banner.visibility = View.VISIBLE
            }
            !Settings.canDrawOverlays(this) -> {
                text.text = getString(R.string.setup_overlay)
                button.text = getString(R.string.setup_overlay_button)
                button.setOnClickListener {
                    startActivity(
                        Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:$packageName")
                        )
                    )
                }
                banner.visibility = View.VISIBLE
            }
            Store.lockedApps(this).isEmpty() -> {
                text.text = getString(R.string.setup_apps)
                button.text = getString(R.string.setup_apps_button)
                button.setOnClickListener {
                    startActivity(Intent(this, ParentActivity::class.java))
                }
                banner.visibility = View.VISIBLE
            }
            else -> banner.visibility = View.GONE
        }
    }

    companion object {
        /** Be van-e kapcsolva a figyelő a rendszer beállításaiban. */
        fun guardEnabled(c: Context): Boolean {
            val flat = Settings.Secure.getString(
                c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            val me = c.packageName + "/" + GuardService::class.java.name
            return flat.split(':').any { it.equals(me, ignoreCase = true) }
        }
    }
}
