# OpenClaw Android ProGuard/R8 Configuration
# Optimizes APK size and performance while preserving necessary classes

# ============================================================================
# Keep OpenClaw Classes
# ============================================================================

# Keep all OpenClaw application classes
-keep class com.helix.** { *; }
-keep interface com.helix.** { *; }

# Keep Email, Calendar, Tasks related classes
-keep class ai.openclaw.android.** { *; }
-keep interface ai.openclaw.android.** { *; }

# ============================================================================
# Kotlin & Coroutines
# ============================================================================

# Keep Kotlin classes
-keep class kotlin.** { *; }
-keep interface kotlin.** { *; }

# Keep Coroutines
-keep class kotlinx.coroutines.** { *; }
-keepclassmembers class kotlinx.coroutines.** { *; }

# Keep Kotlin metadata for reflection
-keepattributes SourceFile,LineNumberTable
-keep class kotlin.Metadata { *; }

# ============================================================================
# Serialization (kotlinx.serialization)
# ============================================================================

-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

# Keep serializable classes and their companions
-keep @kotlinx.serialization.Serializable class * { *; }
-keepclassmembers class * {
    *** Companion;
}

# Keep serialization adapters
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# ============================================================================
# AndroidX / Material Libraries
# ============================================================================

-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-keepattributes *AndroidManifest*

# Material Design Components
-keep class com.google.android.material.** { *; }
-keepclassmembers class com.google.android.material.** { *; }

# Jetpack Compose
-keep class androidx.compose.** { *; }
-keep interface androidx.compose.** { *; }
-keepclassmembers class androidx.compose.** { *; }

# ============================================================================
# OkHttp & Networking
# ============================================================================

-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }

-dontwarn okhttp3.**
-dontwarn okio.**

# ============================================================================
# JSON & Data Classes
# ============================================================================

# Keep data classes and model objects
-keep class com.helix.models.** { *; }
-keep class com.helix.*.** { *; }

# Preserve enum values for serialization
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================================================
# Reflection Support
# ============================================================================

# Keep classes used with reflection
-keep class * implements java.io.Serializable { *; }
-keep class * implements java.io.Parcelable { *; }
-keepclassmembers class * implements java.io.Parcelable {
    static ** CREATOR;
}

# ============================================================================
# Remove Logging in Release Build
# ============================================================================

# Remove Log.d, Log.v, Log.i calls
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}

# But keep Log.e and Log.w
-keepclassmembers class android.util.Log {
    public static int e(...);
    public static int w(...);
}

# ============================================================================
# Optimization Settings
# ============================================================================

-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Remove unused code
-dontshrink

# Optimize code
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*

# ============================================================================
# Keep Source/Line Numbers for Crashes
# ============================================================================

-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ============================================================================
# Performance Monitoring Classes
# ============================================================================

-keep class com.helix.performance.** { *; }
-keep class com.helix.metrics.** { *; }

# ============================================================================
# Native Methods
# ============================================================================

-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================================================
# Avoid Obfuscation for Public API
# ============================================================================

# If this is a library, keep public classes
-keeppublic class com.helix.api.** {
    public <methods>;
}

# ============================================================================
# Testing Classes (exclude in release)
# ============================================================================

# These will be removed in release builds via buildTypes
-dontwarn com.helix.test.**
-dontwarn org.junit.**
-dontwarn org.mockito.**

# ============================================================================
# Third-party Library Rules
# ============================================================================

# DNS Java
-keep class dnsjava.** { *; }
-keepclassmembers class dnsjava.** { *; }

# ============================================================================
# Debugging
# ============================================================================

# Enable ProGuard logging for analysis
# Uncomment to debug ProGuard:
# -printmapping out/mapping.txt
# -printusage out/usage.txt
# -printseeds out/seeds.txt

# ============================================================================
# Performance Rules
# ============================================================================

# Inline simple getters/setters for performance
-allowaccessmodification

# Merge small classes to reduce method count
-mergeinterfacesaggressively

# Remove unused parameters
-keepparameternames

# ============================================================================
# Final Optimizations
# ============================================================================

# Update the class references
-updateconstantpool

# Preverify for faster loading (important for mobile)
-preverify
