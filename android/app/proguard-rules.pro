# ── Capacitor WebView ProGuard Rules ──
# Keep Capacitor core and plugins intact
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-dontwarn com.getcapacitor.**

# Keep WebView JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin annotations
-keepattributes *Annotation*

# Keep AndroidX used by Capacitor
-keep class androidx.** { *; }
-dontwarn androidx.**

# Optimizations safe for WebView-only apps
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Suppress common warnings
-dontwarn org.apache.**
-dontwarn org.xmlpull.**
-dontwarn okhttp3.**
-dontwarn javax.annotation.**
