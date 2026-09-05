package hu.kredit

import android.content.Intent
import android.webkit.JavascriptInterface

/**
 * A WebView és a natív réteg közti híd. A webes felület ezen keresztül tárol,
 * így ugyanazt a rekordot látja a zárolást végző szolgáltatás is.
 */
class KreditBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun getItem(key: String): String? = Store.raw(activity, key)

    @JavascriptInterface
    fun setItem(key: String, value: String) {
        Store.putRaw(activity, key, value.ifEmpty { null })
    }

    @JavascriptInterface
    fun openParentScreen() {
        activity.runOnUiThread {
            activity.startActivity(Intent(activity, ParentActivity::class.java))
        }
    }
}
