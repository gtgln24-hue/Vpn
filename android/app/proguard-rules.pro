# Capacitor Bridge & Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.CapacitorPlugin <fields>;
}

# GLN Tunnel App Components & Custom Capacitor Plugin
-keep class com.gln.tunnel.** { *; }
-keepclassmembers class com.gln.tunnel.bridge.GlnVpnPlugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# Keep Android VpnService & Boot BroadcastReceiver
-keep class com.gln.tunnel.vpn.GlnVpnService { *; }
-keep class com.gln.tunnel.vpn.BootReceiver { *; }

# JSch SSH Library Rules
-keep class com.jcraft.jsch.** { *; }
-keepclassmembers class com.jcraft.jsch.** { *; }
-dontwarn com.jcraft.jsch.**

# Native Libraries & JNI methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Preserve stacktrace line numbers & generic signatures for release debugging
-keepattributes SourceFile,LineNumberTable,Signature,*Annotation*
-renamesourcefileattribute SourceFile
