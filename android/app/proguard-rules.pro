# A WebView JavaScript-hídja reflexióval hívódik, ezért meg kell tartani.
-keepclassmembers class hu.kredit.KreditBridge {
    @android.webkit.JavascriptInterface <methods>;
}
