package com.gln.tunnel.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.gln.tunnel.socks.Tun2SocksEngine
import com.gln.tunnel.ssh.SshTunnelEngine
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean

class GlnVpnService : VpnService(), SshTunnelEngine.SshEventListener {

    companion object {
        const val CHANNEL_ID = "GlnVpnChannel"
        const val NOTIFICATION_ID = 101

        const val ACTION_START_VPN = "com.gln.tunnel.START_VPN"
        const val ACTION_STOP_VPN = "com.gln.tunnel.STOP_VPN"

        const val EXTRA_HOST = "extra_host"
        const val EXTRA_PORT = "extra_port"
        const val EXTRA_USER = "extra_user"
        const val EXTRA_PASS = "extra_pass"
        const val EXTRA_KEY_PATH = "extra_key_path"
        const val EXTRA_PASSPHRASE = "extra_passphrase"
        const val EXTRA_DNS_PRIMARY = "extra_dns_primary"
        const val EXTRA_DNS_SECONDARY = "extra_dns_secondary"
        const val EXTRA_SOCKS_PORT = "extra_socks_port"
        const val EXTRA_KILL_SWITCH = "extra_kill_switch"
        const val EXTRA_ALLOWED_APPS = "extra_allowed_apps"
        const val EXTRA_DISALLOWED_APPS = "extra_disallowed_apps"
        const val EXTRA_MTU = "extra_mtu"

        @Volatile
        var isVpnActive = false
            private set

        @Volatile
        var lastStatus = "Disconnected"
            private set

        @Volatile
        var connectedAtTimeMs: Long = 0L
            private set

        @Volatile
        var cachedHostName: String = ""
            private set

        data class LogEntry(val message: String, val level: String, val timestamp: Long)

        val recentLogs = java.util.concurrent.ConcurrentLinkedQueue<LogEntry>()

        var statusListener: ((String, String) -> Unit)? = null
        var logListener: ((String, String, Long) -> Unit)? = null

        fun addLog(message: String, level: String = "info") {
            val ts = System.currentTimeMillis()
            val entry = LogEntry(message, level, ts)
            recentLogs.add(entry)
            while (recentLogs.size > 100) {
                recentLogs.poll()
            }
            logListener?.invoke(message, level, ts)
        }

        fun getUptimeSeconds(): Long {
            return if (isVpnActive && connectedAtTimeMs > 0L) {
                (System.currentTimeMillis() - connectedAtTimeMs) / 1000L
            } else {
                0L
            }
        }
    }

    private var tunFd: ParcelFileDescriptor? = null
    private var sshEngine: SshTunnelEngine? = null
    private var tun2SocksEngine: Tun2SocksEngine? = null

    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: android.net.wifi.WifiManager.WifiLock? = null

    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GLNTunnel:VpnWakeLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(12 * 3600 * 1000L) // 12h safety lock
            }

            if (wifiLock == null) {
                val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? android.net.wifi.WifiManager
                @Suppress("DEPRECATION")
                wifiLock = wifiManager?.createWifiLock(android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF, "GLNTunnel:WifiLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (wifiLock?.isHeld == false) {
                wifiLock?.acquire()
            }
        } catch (e: Exception) {
            Log.e("GlnVpnService", "Failed to acquire wake/wifi locks", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
            }
        } catch (e: Exception) {
            Log.e("GlnVpnService", "Failed to release wake/wifi locks", e)
        }
    }

    private val pipelineLock = Any()

    @Volatile
    private var isStopping = false

    private val isReconnecting = AtomicBoolean(false)
    private val isReconnectThreadRunning = AtomicBoolean(false)

    // Cached configurations for auto-reconnect
    private var cachedHost = ""
    private var cachedPort = 22
    private var cachedUser = ""
    private var cachedPass: String? = null
    private var cachedKeyPath: String? = null
    private var cachedPassphrase: String? = null
    private var cachedSocksPort = 10808
    private var cachedDnsPrimary = "1.1.1.1"
    private var cachedDnsSecondary = "8.8.8.8"
    private var cachedMtu = 1420
    private var cachedKillSwitch = true
    private var cachedAllowedApps: ArrayList<String>? = null
    private var cachedDisallowedApps: ArrayList<String>? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        registerNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START_VPN
        if (action == ACTION_STOP_VPN) {
            stopVpnService("User requested disconnect")
            return START_NOT_STICKY
        }

        if (intent != null) {
            cachedHost = intent.getStringExtra(EXTRA_HOST) ?: ""
            cachedPort = intent.getIntExtra(EXTRA_PORT, 22)
            cachedUser = intent.getStringExtra(EXTRA_USER) ?: ""
            cachedPass = intent.getStringExtra(EXTRA_PASS)
            cachedKeyPath = intent.getStringExtra(EXTRA_KEY_PATH)
            cachedPassphrase = intent.getStringExtra(EXTRA_PASSPHRASE)
            cachedSocksPort = intent.getIntExtra(EXTRA_SOCKS_PORT, 10808)
            cachedDnsPrimary = intent.getStringExtra(EXTRA_DNS_PRIMARY) ?: "1.1.1.1"
            cachedDnsSecondary = intent.getStringExtra(EXTRA_DNS_SECONDARY) ?: "8.8.8.8"
            cachedMtu = intent.getIntExtra(EXTRA_MTU, 1420)
            cachedKillSwitch = intent.getBooleanExtra(EXTRA_KILL_SWITCH, true)
            cachedAllowedApps = intent.getStringArrayListExtra(EXTRA_ALLOWED_APPS)
            cachedDisallowedApps = intent.getStringArrayListExtra(EXTRA_DISALLOWED_APPS)

            if (cachedHost.isNotBlank() && cachedUser.isNotBlank()) {
                val prefs = getSharedPreferences("gln_vpn_prefs", Context.MODE_PRIVATE)
                prefs.edit()
                    .putString("host", cachedHost)
                    .putInt("port", cachedPort)
                    .putString("user", cachedUser)
                    .putString("pass", cachedPass)
                    .putString("key_path", cachedKeyPath)
                    .putString("passphrase", cachedPassphrase)
                    .putInt("socks_port", cachedSocksPort)
                    .putString("dns_primary", cachedDnsPrimary)
                    .putString("dns_secondary", cachedDnsSecondary)
                    .putInt("mtu", cachedMtu)
                    .putBoolean("kill_switch", cachedKillSwitch)
                    .putBoolean("auto_reconnect_on_boot", true)
                    .apply()
            }
        }

        startForegroundServiceNotification("Connecting to SSH Tunnel...")

        if (cachedHost.isEmpty() || cachedUser.isEmpty()) {
            updateStatus("Error", "Missing SSH host or username")
            stopVpnService("Configuration error")
            return START_NOT_STICKY
        }

        startTunnelPipeline()
        return START_STICKY
    }

    private fun startTunnelPipeline() {
        synchronized(pipelineLock) {
            if (isStopping) return
            updateStatus("Connecting", "Protecting socket and resolving $cachedHost...")

            // Step 1: Initialize SSH Tunnel Engine with socket protection callback
            sshEngine = SshTunnelEngine(this, socketProtector = { socket: Socket ->
                val protected = protect(socket)
                if (protected) {
                    Log.d("GlnVpnService", "Protected SSH Socket from TUN loop: ${socket.localPort}")
                } else {
                    Log.e("GlnVpnService", "Failed to protect SSH socket!")
                }
                protected
            })

            // Step 2: Establish SSH connection
            sshEngine?.connect(
                host = cachedHost,
                port = cachedPort,
                user = cachedUser,
                password = cachedPass,
                privateKeyPath = cachedKeyPath,
                passphrase = cachedPassphrase,
                socksPort = cachedSocksPort
            )
        }
    }

    private fun establishTunInterface() {
        synchronized(pipelineLock) {
            if (isStopping) return
            try {
                updateStatus("Connecting", "Building secure TUN interface (IPv4 + IPv6)...")
                val builder = Builder()

                // IPv4 and IPv6 Routing (Prevents IPv6 Leak)
                builder.addAddress("10.0.0.1", 24)
                builder.addRoute("0.0.0.0", 0)

                builder.addAddress("fd00:1:2:3::1", 64)
                builder.addRoute("::", 0)

                // DNS Leak Prevention: Route all DNS through tunnel
                builder.addDnsServer(cachedDnsPrimary)
                builder.addDnsServer(cachedDnsSecondary)
                builder.addDnsServer("fd00:1:2:3::8888")

                builder.setMtu(cachedMtu)
                builder.setSession("GLN Tunnel - Connected")

                // Split Tunneling Application Filtering
                cachedAllowedApps?.let { apps ->
                    for (pkg in apps) {
                        if (pkg.isNotBlank()) {
                            try {
                                builder.addAllowedApplication(pkg)
                                Log.d("GlnVpnService", "Split tunneling: allowed $pkg")
                            } catch (e: Exception) {
                                Log.w("GlnVpnService", "Could not allow package $pkg", e)
                            }
                        }
                    }
                }

                if (cachedAllowedApps.isNullOrEmpty()) {
                    cachedDisallowedApps?.let { apps ->
                        for (pkg in apps) {
                            if (pkg.isNotBlank()) {
                                try {
                                    builder.addDisallowedApplication(pkg)
                                    Log.d("GlnVpnService", "Split tunneling: disallowed $pkg")
                                } catch (e: Exception) {
                                    Log.w("GlnVpnService", "Could not disallow package $pkg", e)
                                }
                            }
                        }
                    }
                }

                builder.setBlocking(true)

                tunFd?.close()
                tunFd = builder.establish()

                if (tunFd == null) {
                    throw Exception("VpnService.Builder.establish() returned null. Check VPN permissions.")
                }

                Log.i("GlnVpnService", "TUN interface established successfully with FD: ${tunFd?.fd}")

                // Start tun2socks engine to map TUN to SSH Local SOCKS5 Proxy
                tun2SocksEngine = Tun2SocksEngine(object : Tun2SocksEngine.Tun2SocksListener {
                    override fun onTun2SocksLog(message: String, level: String) {
                        onSshLog(message, level)
                    }
                    override fun onTun2SocksStarted() {
                        Log.i("GlnVpnService", "tun2Socks engine started")
                    }
                    override fun onTun2SocksStopped() {
                        Log.i("GlnVpnService", "tun2Socks engine stopped")
                    }
                })
                tunFd?.let { pfd ->
                    tun2SocksEngine?.start(
                        vpnFd = pfd,
                        socksHost = "127.0.0.1",
                        socksPort = cachedSocksPort,
                        mtu = cachedMtu,
                        dnsIp = cachedDnsPrimary
                    )
                }

                isVpnActive = true
                connectedAtTimeMs = System.currentTimeMillis()
                cachedHostName = cachedHost
                updateStatus("Connected", "VPN Active. Traffic routed through $cachedHost")
                startForegroundServiceNotification("VPN Connected - $cachedHost")

            } catch (e: Exception) {
                Log.e("GlnVpnService", "Failed to establish TUN interface", e)
                updateStatus("Error", "TUN Setup Error: ${e.message}")
                stopVpnService("TUN Error")
            }
        }
    }

    // --- SSH Engine Event Listeners ---
    override fun onSshLog(message: String, level: String) {
        Log.d("GlnVpnService", "[$level] $message")
        addLog(message, level)
        statusListener?.invoke("LOG", "[$level] $message")
    }

    override fun onSshConnected(localSocksPort: Int) {
        synchronized(pipelineLock) {
            if (isStopping) {
                Log.w("GlnVpnService", "SSH connected while VPN service stopping. Disconnecting SSH.")
                sshEngine?.disconnect("Service stopping")
                return
            }
            Log.i("GlnVpnService", "SSH Tunnel Established. Local SOCKS5 running on $localSocksPort")
            establishTunInterface()
        }
    }

    override fun onSshDisconnected(reason: String) {
        Log.w("GlnVpnService", "SSH Tunnel Disconnected: $reason")
        if (isVpnActive && !isStopping && !isReconnecting.get()) {
            if (cachedKillSwitch) {
                updateStatus("Reconnecting", "Tunnel lost. Kill switch engaged, reconnecting...")
                handleAutoReconnect()
            } else {
                stopVpnService("Tunnel disconnected")
            }
        }
    }

    override fun onSshError(error: String) {
        Log.e("GlnVpnService", "SSH Engine Error: $error")
        updateStatus("Error", error)
        if (isVpnActive && !isStopping && cachedKillSwitch) {
            handleAutoReconnect()
        }
    }

    // --- Automatic Network Handoff & Reconnection ---
    private fun registerNetworkCallback() {
        try {
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    if (isVpnActive && !isStopping) {
                        Log.i("GlnVpnService", "Network interface restored ($network). Setting underlying network.")
                        try {
                            setUnderlyingNetworks(arrayOf(network))
                        } catch (e: Exception) {
                            Log.e("GlnVpnService", "Failed to set underlying network", e)
                        }
                        if (isReconnecting.get() || sshEngine == null) {
                            Log.i("GlnVpnService", "Network restored. Triggering SSH auto-reconnect...")
                            handleAutoReconnect()
                        }
                    }
                }

                override fun onLost(network: Network) {
                    if (isVpnActive && !isStopping) {
                        Log.w("GlnVpnService", "Network lost ($network). Engaging VPN reconnect buffer...")
                        try {
                            setUnderlyingNetworks(null)
                        } catch (e: Exception) {
                            Log.e("GlnVpnService", "Failed to clear underlying networks", e)
                        }
                        updateStatus("Reconnecting", "Network lost. Waiting for connection...")
                        isReconnecting.set(true)
                    }
                }
            }
            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        } catch (e: Exception) {
            Log.e("GlnVpnService", "Error registering network callback", e)
        }
    }

    private fun handleAutoReconnect() {
        if (isStopping) return
        if (isReconnectThreadRunning.compareAndSet(false, true)) {
            isReconnecting.set(true)
            Thread {
                try {
                    var attempt = 0
                    val maxAttempts = 10
                    var delayMs = 1000L

                    while (isVpnActive && !isStopping && attempt < maxAttempts) {
                        attempt++
                        Log.i("GlnVpnService", "Auto-reconnect attempt $attempt/$maxAttempts (backoff delay ${delayMs}ms)...")
                        updateStatus("Reconnecting", "Re-establishing secure tunnel (Attempt $attempt/$maxAttempts)...")

                        try {
                            tun2SocksEngine?.stop()
                            sshEngine?.disconnect("Auto-reconnect retry")
                        } catch (e: Exception) {
                            Log.e("GlnVpnService", "Error stopping engines for reconnect", e)
                        }

                        Thread.sleep(delayMs)
                        if (!isVpnActive || isStopping) break

                        startTunnelPipeline()

                        // Check for connection success
                        Thread.sleep(3000)
                        if (sshEngine?.isConnected() == true) {
                            Log.i("GlnVpnService", "Auto-reconnect successful on attempt $attempt!")
                            break
                        }

                        // Exponential backoff with 30s cap
                        delayMs = (delayMs * 2).coerceAtMost(30000L)
                    }

                    if (attempt >= maxAttempts && sshEngine?.isConnected() != true && !isStopping) {
                        updateStatus("Error", "Auto-reconnect failed after $maxAttempts attempts")
                        stopVpnService("Auto-reconnect exhausted")
                    }
                } catch (e: Exception) {
                    Log.e("GlnVpnService", "Error during auto-reconnect", e)
                } finally {
                    isReconnectThreadRunning.set(false)
                    isReconnecting.set(false)
                }
            }.start()
        }
    }

    private fun stopVpnService(reason: String) {
        synchronized(pipelineLock) {
            isStopping = true
            isVpnActive = false
            connectedAtTimeMs = 0L
            isReconnecting.set(false)
            releaseWakeLock()

            try {
                val prefs = getSharedPreferences("gln_vpn_prefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("auto_reconnect_on_boot", false).apply()
            } catch (e: Exception) {
                Log.e("GlnVpnService", "Failed to update boot preferences", e)
            }

            updateStatus("Disconnected", reason)

            try {
                tun2SocksEngine?.stop()
                sshEngine?.disconnect(reason)
                tunFd?.close()
                tunFd = null
            } catch (e: Exception) {
                Log.e("GlnVpnService", "Error during VPN cleanup", e)
            } finally {
                isStopping = false
            }

            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.i("GlnVpnService", "App task swiped from Recents list. VPN foreground service remains active.")
        if (isVpnActive) {
            startForegroundServiceNotification("VPN Connected - $cachedHost")
        }
    }

    private fun updateStatus(status: String, message: String) {
        lastStatus = "$status: $message"
        addLog("Status: $status ($message)", if (status == "Error") "error" else if (status == "Connected") "success" else "info")
        statusListener?.invoke(status, message)
        if (isVpnActive || status == "Connecting" || status == "Reconnecting") {
            startForegroundServiceNotification("$status - $message")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "GLN VPN Service"
            val descriptionText = "Persistent VPN Connection Notifications"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceNotification(statusMessage: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, GlnVpnService::class.java)
        val pendingContentIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, GlnVpnService::class.java).apply {
            action = ACTION_STOP_VPN
        }
        val pendingStopIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GLN Tunnel VPN")
            .setContentText(statusMessage)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingContentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_pause, "Disconnect", pendingStopIntent)
            .build()

        acquireWakeLock()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        releaseWakeLock()
        networkCallback?.let {
            connectivityManager?.unregisterNetworkCallback(it)
        }
        stopVpnService("Service Destroyed")
    }
}
