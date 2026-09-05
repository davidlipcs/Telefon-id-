package hu.kredit

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Szülői képernyő: melyik appot zárolja a telefon, él-e a védelem, és mikor
 * nyúltak hozzá. A PIN ugyanaz, amit a webes felületen állítottál be.
 */
class ParentActivity : AppCompatActivity() {

    private lateinit var root: LinearLayout
    private val checks = mutableMapOf<String, CheckBox>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_parent)
        root = findViewById(R.id.parentRoot)
        if (Store.pin(this).isEmpty()) buildMain() else buildPinGate()
    }

    // ---------- PIN ----------

    private fun buildPinGate() {
        root.removeAllViews()
        root.addView(heading(getString(R.string.parent_locked)))
        root.addView(body(getString(R.string.parent_locked_body)))

        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = getString(R.string.parent_pin_hint)
            setTextColor(color(R.color.ink))
            gravity = Gravity.CENTER
        }.wide(10)
        root.addView(input)
        root.addView(primary(getString(R.string.parent_unlock)) {
            if (input.text.toString() == Store.pin(this)) buildMain()
            else toastLike(getString(R.string.parent_pin_wrong))
        })
    }

    private fun toastLike(msg: String) {
        root.addView(TextView(this).apply {
            text = msg
            setTextColor(color(R.color.bad))
            textSize = 14f
            setPadding(0, dp(10), 0, 0)
        }.wide())
    }

    // ---------- fő nézet ----------

    private fun buildMain() {
        root.removeAllViews()

        root.addView(heading(getString(R.string.parent_status)))
        val guardOn = MainActivity.guardEnabled(this)
        val overlayOn = android.provider.Settings.canDrawOverlays(this)
        root.addView(status(getString(R.string.status_guard), guardOn))
        root.addView(status(getString(R.string.status_overlay), overlayOn))
        if (!guardOn) {
            root.addView(primary(getString(R.string.setup_guard_button)) {
                startActivity(Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))
            })
        }

        root.addView(heading(getString(R.string.parent_apps)))
        root.addView(body(getString(R.string.parent_apps_body)))

        val locked = Store.lockedApps(this)
        checks.clear()
        installedApps().forEach { (pkg, label) ->
            val cb = CheckBox(this).apply {
                text = label
                isChecked = locked.contains(pkg)
                setTextColor(color(R.color.ink))
                textSize = 16f
            }.wide()
            checks[pkg] = cb
            root.addView(cb)
        }
        root.addView(primary(getString(R.string.parent_save)) {
            Store.setLockedApps(this, checks.filterValues { it.isChecked }.keys)
            toastLike(getString(R.string.parent_saved))
        })

        root.addView(heading(getString(R.string.parent_log)))
        root.addView(body(getString(R.string.parent_log_body)))
        val log = Store.guardLog(this)
        if (log.isEmpty()) {
            root.addView(body(getString(R.string.parent_log_empty)))
        } else {
            log.take(20).forEach { root.addView(body(it)) }
        }
    }

    /** Indítható appok, a sajátunk nélkül, névsorban. */
    private fun installedApps(): List<Pair<String, String>> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return packageManager.queryIntentActivities(intent, 0)
            .mapNotNull { it.activityInfo?.packageName }
            .filter { it != packageName }
            .distinct()
            .map { it to Store.appLabel(this, it) }
            .sortedBy { it.second.lowercase() }
    }

    // ---------- apró építőelemek ----------

    private fun color(id: Int) = ContextCompat.getColor(this, id)

    /** Függőleges LinearLayout-ban minden sor a teljes szélességet kapja. */
    private fun <T : View> T.wide(topDp: Int = 0): T = apply {
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(topDp) }
    }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun heading(t: String) = TextView(this).apply {
        text = t
        setTextColor(color(R.color.fuel))
        textSize = 18f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(22), 0, dp(6))
    }.wide()

    private fun body(t: String) = TextView(this).apply {
        text = t
        setTextColor(color(R.color.muted))
        textSize = 14f
        setPadding(0, 0, 0, dp(6))
    }.wide()

    private fun status(label: String, on: Boolean) = TextView(this).apply {
        text = (if (on) "●  " else "○  ") + label +
            " — " + getString(if (on) R.string.status_on else R.string.status_off)
        setTextColor(if (on) color(R.color.ink) else color(R.color.bad))
        textSize = 15f
        setPadding(0, dp(4), 0, dp(4))
    }.wide()

    private fun primary(t: String, onClick: () -> Unit) = Button(this).apply {
        text = t
        setTextColor(Color.parseColor("#231502"))
        backgroundTintList = ContextCompat.getColorStateList(this@ParentActivity, R.color.fuel)
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(14) }
        setOnClickListener { onClick() }
    }
}
