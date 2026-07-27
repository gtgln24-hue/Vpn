package com.gln.tunnel.socks

import android.os.Build
import android.util.Log

object NativeLibLoader {
    private const val TAG = "NativeLibLoader"
    
    @Volatile
    private var isTun2SocksLoaded = false

    fun loadTun2SocksLibrary(): Boolean {
        if (isTun2SocksLoaded) return true

        val supportedAbis = Build.SUPPORTED_ABIS.joinToString(", ")
        Log.i(TAG, "Checking native ABIs for architecture compatibility: [$supportedAbis]")

        try {
            System.loadLibrary("tun2socks")
            isTun2SocksLoaded = true
            Log.i(TAG, "Native library 'libtun2socks.so' loaded successfully for ABI ${Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"}")
            return true
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Native library 'libtun2socks.so' not found or ABI incompatible. Fallback to Java/Kotlin engine. Details: ${e.message}")
            isTun2SocksLoaded = false
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected failure loading native library", e)
            isTun2SocksLoaded = false
            return false
        }
    }

    fun isNativeLoaded(): Boolean = isTun2SocksLoaded
}
