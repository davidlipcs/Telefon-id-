package hu.kredit

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

/**
 * A zárolás motorja.
 *
 * Kisegítő szolgáltatásként fut, mert a rendszer ezt magától elindítja
 * bekapcsoláskor és nem lövi ki a háttérben — így nem kell sem boot-vevő, sem
 * előtérszolgáltatás, és a felhasználónak semmit nem kell elindítania.
 *
 * Csak az ablakváltásokat kéri, a képernyő tartalmát nem olvassa
 * (canRetrieveWindowContent=false).
 */
class GuardService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private var overlay: BlockOverlay? = null

    private var runPkg: String? = null
    private var runLabel = ""
    private var runStartElapsed = 0L
    private var runStartWall = 0L
    private var committed = 0

    /** A panel megjelenése után rövid ideig a saját csomagunk eseménye nem számít. */
    private var ignoreSelfUntil = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        overlay = BlockOverlay(this)
        Store.logGuard(this, true)
    }

    override fun onUnbind(intent: Intent?): Boolean {
        stopRun()
        overlay?.hide()
        Store.logGuard(this, false)
        return super.onUnbind(intent)
    }

    override fun onInterrupt() {}

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        if (pkg == packageName) {
            // A saját appunk jött előre: a panel dolga véget ért.
            if (SystemClock.elapsedRealtime() > ignoreSelfUntil) {
                overlay?.hide()
                stopRun()
            }
            return
        }
        if (pkg == "com.android.systemui") return
        if (pkg == runPkg) return

        stopRun()
        if (!Store.lockedApps(this).contains(pkg)) return

        if (Store.remainingMinutes(this) <= 0) block() else startRun(pkg)
    }

    private fun startRun(pkg: String) {
        runPkg = pkg
        runLabel = Store.appLabel(this, pkg)
        // elapsedRealtime: az óra átállítása nem befolyásolja a mért időt
        runStartElapsed = SystemClock.elapsedRealtime()
        runStartWall = System.currentTimeMillis()
        committed = 0
        handler.removeCallbacks(ticker)
        handler.post(ticker)
    }

    private fun stopRun() {
        handler.removeCallbacks(ticker)
        val pkg = runPkg ?: return
        commitElapsed()
        Store.addPlaySession(this, runLabel, committed, runStartWall)
        runPkg = null
        committed = 0
    }

    private fun commitElapsed() {
        val mins = ((SystemClock.elapsedRealtime() - runStartElapsed) / 60_000L).toInt()
        if (mins > committed) {
            Store.addPlayed(this, mins - committed)
            committed = mins
        }
    }

    private val ticker = object : Runnable {
        override fun run() {
            if (runPkg == null) return
            commitElapsed()
            Store.noteClock(this@GuardService)
            if (Store.remainingMinutes(this@GuardService) <= 0) {
                block()
                return
            }
            handler.postDelayed(this, 1000L)
        }
    }

    /** Kiteszi a zárolt appot az előtérből, és megmondja, miért. */
    private fun block() {
        stopRun()
        ignoreSelfUntil = SystemClock.elapsedRealtime() + 2000L
        performGlobalAction(GLOBAL_ACTION_HOME)
        overlay?.show()
    }
}
