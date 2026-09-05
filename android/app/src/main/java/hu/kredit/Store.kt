package hu.kredit

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * A WebView és a natív réteg közös tárolója.
 *
 * A webes felület a saját kulcsain ír ("p:" a privát, "s:" a megosztott
 * rekordoké) — ugyanaz a séma, mint böngészőben. A figyelő szolgáltatás
 * ezekből olvassa ki a mai keretet, hogy akkor is tudja, mennyi van hátra,
 * amikor a felület nem fut.
 */
object Store {

    private const val FILE = "kredit"
    private const val PRIV = "p:"
    private const val SHARED = "s:"

    /** Csak natív: a zárolt appok csomagnevei. */
    private const val LOCKED = "kredit-locked-apps"
    /** Csak natív: mikor kapcsolták ki a védelmet, mikor nyúltak az órához. */
    private const val GUARD_LOG = "kredit-guard-log"
    private const val LAST_CLOCK = "kredit-last-clock"

    private fun prefs(c: Context): SharedPreferences =
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun raw(c: Context, key: String): String? = prefs(c).getString(key, null)

    fun putRaw(c: Context, key: String, value: String?) {
        prefs(c).edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }

    private fun obj(c: Context, key: String): JSONObject? =
        raw(c, key)?.let { runCatching { JSONObject(it) }.getOrNull() }

    fun device(c: Context): JSONObject? = obj(c, PRIV + "kredit-device")

    fun pin(c: Context): String = device(c)?.optString("pin").orEmpty()

    /** A most élő szóló- vagy családrekord a szerep szerint, a kulcsával együtt. */
    private fun record(c: Context): Pair<String, JSONObject>? {
        val d = device(c) ?: return null
        val key = when (d.optString("role")) {
            "solo" -> PRIV + "kredit-solo"
            "parent", "child" -> SHARED + "kredit-fam-" + d.optString("code")
            else -> return null
        }
        val rec = obj(c, key) ?: return null
        return key to rec
    }

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun todayObj(rec: JSONObject): JSONObject? =
        rec.optJSONObject("days")?.optJSONObject(today())

    /** Elindította-e már a mai napot? Enélkül nincs keret, tehát minden zárolt. */
    fun dayStarted(c: Context): Boolean {
        val (_, rec) = record(c) ?: return false
        return todayObj(rec) != null
    }

    /** Hány perc játékidő van hátra mára. Ha a nap nem indult el: nulla. */
    fun remainingMinutes(c: Context): Int {
        val (_, rec) = record(c) ?: return 0
        val day = todayObj(rec) ?: return 0
        val total = day.optInt("base") + day.optInt("earned")
        return (total - day.optInt("played")).coerceAtLeast(0)
    }

    /** Lejátszott percek növelése — ezt a figyelő hívja percenként. */
    @Synchronized
    fun addPlayed(c: Context, minutes: Int) {
        if (minutes <= 0) return
        val (key, rec) = record(c) ?: return
        val day = todayObj(rec) ?: return
        day.put("played", day.optInt("played") + minutes)
        putRaw(c, key, rec.toString())
    }

    /** Egy befejezett játékkör a naplóba, ugyanabban a formában, mint a weben. */
    @Synchronized
    fun addPlaySession(c: Context, game: String, minutes: Int, startedAt: Long) {
        if (minutes <= 0) return
        val (key, rec) = record(c) ?: return
        val day = todayObj(rec) ?: return
        val sessions = day.optJSONArray("sessions") ?: JSONArray().also { day.put("sessions", it) }
        sessions.put(
            JSONObject()
                .put("type", "play")
                .put("game", game)
                .put("minutes", minutes)
                .put("time", SimpleDateFormat("HH:mm", Locale.US).format(Date(startedAt)))
        )
        putRaw(c, key, rec.toString())
    }

    fun lockedApps(c: Context): Set<String> {
        val arr = runCatching { JSONArray(raw(c, LOCKED) ?: "[]") }.getOrNull() ?: return emptySet()
        return (0 until arr.length()).mapNotNull { arr.optString(it).ifEmpty { null } }.toSet()
    }

    fun setLockedApps(c: Context, pkgs: Set<String>) {
        val arr = JSONArray()
        pkgs.sorted().forEach { arr.put(it) }
        putRaw(c, LOCKED, arr.toString())
    }

    fun appLabel(c: Context, pkg: String): String = runCatching {
        val pm = c.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)

    /**
     * Napló arról, mikor élt és mikor nem a védelem. Ez az egyetlen dolog, amit
     * a szülő láthat abból, ha a gyerek kikapcsolta a szolgáltatást — megelőzni
     * eszközgazda-jog nélkül nem lehet, kimutatni igen.
     */
    @Synchronized
    fun logGuard(c: Context, on: Boolean, note: String = "") {
        val arr = runCatching { JSONArray(raw(c, GUARD_LOG) ?: "[]") }.getOrNull() ?: JSONArray()
        val stamp = SimpleDateFormat("MM-dd HH:mm", Locale.US).format(Date())
        arr.put(JSONObject().put("t", stamp).put("on", on).put("note", note))
        val trimmed = JSONArray()
        val from = (arr.length() - 50).coerceAtLeast(0)
        for (i in from until arr.length()) trimmed.put(arr.get(i))
        putRaw(c, GUARD_LOG, trimmed.toString())
    }

    fun guardLog(c: Context): List<String> {
        val arr = runCatching { JSONArray(raw(c, GUARD_LOG) ?: "[]") }.getOrNull() ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            arr.optJSONObject(i)?.let { o ->
                val what = o.optString("note").ifEmpty { if (o.optBoolean("on")) "védelem bekapcsolva" else "védelem kikapcsolva" }
                o.optString("t") + " — " + what
            }
        }.reversed()
    }

    /**
     * Óraátállítás észlelése. A játékidő mérése elapsedRealtime-ot használ, azt
     * nem lehet átállítani; a dátumot viszont igen, ezért a visszafelé ugrást
     * feljegyezzük, hogy a szülő lássa.
     */
    fun noteClock(c: Context) {
        val now = System.currentTimeMillis()
        val last = prefs(c).getLong(LAST_CLOCK, 0L)
        if (last != 0L && now < last - 120_000L) logGuard(c, false, "az óra vissza lett állítva")
        prefs(c).edit().putLong(LAST_CLOCK, now).apply()
    }
}
