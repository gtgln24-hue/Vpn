package com.gln.tunnel.bridge

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.gln.tunnel.vpn.GlnVpnService

@CapacitorPlugin(name = "GlnVpn")
class GlnVpnPlugin : Plugin() {

    companion object {
        private const val REQUEST_CODE_VPN_PERMISSION = 1002
    }

    override fun load() {
        super.load()
        GlnVpnService.statusListener = { status, message ->
            val data = JSObject()
            data.put("status", status)
            data.put("message", message)
            data.put("isActive", GlnVpnService.isVpnActive)
            data.put("uptimeSeconds", GlnVpnService.getUptimeSeconds())
            data.put("host", GlnVpnService.cachedHostName)
            notifyListeners("vpnStatusChange", data)
        }

        GlnVpnService.logListener = { message, level, timestamp ->
            val data = JSObject()
            data.put("message", message)
            data.put("level", level)
            data.put("timestamp", timestamp)
            notifyListeners("vpnLogEvent", data)
        }
    }

    override fun handleOnDestroy() {
        GlnVpnService.statusListener = null
        GlnVpnService.logListener = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun prepareVpnPermission(call: PluginCall) {
        val activity = activity ?: run {
            call.reject("Activity unavailable")
            return
        }

        val intent = VpnService.prepare(activity)
        if (intent != null) {
            startActivityForResult(call, intent, REQUEST_CODE_VPN_PERMISSION)
        } else {
            val ret = JSObject()
            ret.put("granted", true)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun checkVpnPermission(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }
        val intent = VpnService.prepare(context)
        val ret = JSObject()
        ret.put("granted", intent == null)
        call.resolve(ret)
    }

    @PluginMethod
    fun isBatteryOptimizationIgnored(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }
        try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = context.packageName
            val isIgnoring = pm.isIgnoringBatteryOptimizations(packageName)
            val ret = JSObject()
            ret.put("isIgnoring", isIgnoring)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to check battery optimization status: ${e.message}")
        }
    }

    @PluginMethod
    fun requestBatteryOptimizationIgnore(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }
        try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = context.packageName
            val isIgnoring = pm.isIgnoringBatteryOptimizations(packageName)

            if (!isIgnoring) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = android.net.Uri.parse("package:$packageName")
                }
                activity?.startActivity(intent)
            }

            val ret = JSObject()
            ret.put("isIgnoring", pm.isIgnoringBatteryOptimizations(packageName))
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to request battery optimization ignore: ${e.message}")
        }
    }

    @PluginMethod
    fun startVpn(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }

        // Verify VPN System Permission
        val prepareIntent = VpnService.prepare(context)
        if (prepareIntent != null) {
            val err = JSObject()
            err.put("error", "VPN_PERMISSION_REQUIRED")
            err.put("message", "System VPN permission has not been granted by user.")
            call.reject("VPN_PERMISSION_REQUIRED", "System VPN permission required", null, err)
            return
        }

        val host = call.getString("host") ?: ""
        val port = call.getInt("port", 22)!!
        val user = call.getString("user") ?: ""
        val pass = call.getString("password")
        val keyPath = call.getString("privateKeyPath")
        val passphrase = call.getString("passphrase")
        val dnsPrimary = call.getString("dnsPrimary") ?: "1.1.1.1"
        val dnsSecondary = call.getString("dnsSecondary") ?: "8.8.8.8"
        val socksPort = call.getInt("socksPort", 10808)!!
        val killSwitch = call.getBoolean("killSwitch", true)!!
        val mtu = call.getInt("mtu", 1420)!!

        val allowedAppsArray = call.getArray("allowedApps")
        val allowedApps = ArrayList<String>()
        if (allowedAppsArray != null) {
            for (i in 0 until allowedAppsArray.length()) {
                allowedApps.add(allowedAppsArray.getString(i))
            }
        }

        val disallowedAppsArray = call.getArray("disallowedApps")
        val disallowedApps = ArrayList<String>()
        if (disallowedAppsArray != null) {
            for (i in 0 until disallowedAppsArray.length()) {
                disallowedApps.add(disallowedAppsArray.getString(i))
            }
        }

        if (host.isBlank() || user.isBlank()) {
            call.reject("Invalid SSH Host or Username")
            return
        }

        val serviceIntent = Intent(context, GlnVpnService::class.java).apply {
            action = GlnVpnService.ACTION_START_VPN
            putExtra(GlnVpnService.EXTRA_HOST, host)
            putExtra(GlnVpnService.EXTRA_PORT, port)
            putExtra(GlnVpnService.EXTRA_USER, user)
            putExtra(GlnVpnService.EXTRA_PASS, pass)
            putExtra(GlnVpnService.EXTRA_KEY_PATH, keyPath)
            putExtra(GlnVpnService.EXTRA_PASSPHRASE, passphrase)
            putExtra(GlnVpnService.EXTRA_DNS_PRIMARY, dnsPrimary)
            putExtra(GlnVpnService.EXTRA_DNS_SECONDARY, dnsSecondary)
            putExtra(GlnVpnService.EXTRA_SOCKS_PORT, socksPort)
            putExtra(GlnVpnService.EXTRA_KILL_SWITCH, killSwitch)
            putExtra(GlnVpnService.EXTRA_MTU, mtu)
            putStringArrayListExtra(GlnVpnService.EXTRA_ALLOWED_APPS, allowedApps)
            putStringArrayListExtra(GlnVpnService.EXTRA_DISALLOWED_APPS, disallowedApps)
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        val res = JSObject()
        res.put("success", true)
        res.put("status", "Starting")
        call.resolve(res)
    }

    @PluginMethod
    fun stopVpn(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }

        val serviceIntent = Intent(context, GlnVpnService::class.java).apply {
            action = GlnVpnService.ACTION_STOP_VPN
        }
        context.startService(serviceIntent)

        val res = JSObject()
        res.put("success", true)
        res.put("status", "Stopping")
        call.resolve(res)
    }

    @PluginMethod
    fun getVpnStatus(call: PluginCall) {
        val res = JSObject()
        val active = GlnVpnService.isVpnActive
        res.put("isActive", active)
        res.put("lastStatus", GlnVpnService.lastStatus)
        res.put("status", if (active) "Connected" else GlnVpnService.lastStatus)
        res.put("uptimeSeconds", GlnVpnService.getUptimeSeconds())
        res.put("host", GlnVpnService.cachedHostName)

        val logsArr = JSArray()
        for (log in GlnVpnService.recentLogs) {
            val obj = JSObject()
            obj.put("message", log.message)
            obj.put("level", log.level)
            obj.put("timestamp", log.timestamp)
            logsArr.put(obj)
        }
        res.put("logs", logsArr)

        call.resolve(res)
    }

    @PluginMethod
    fun getInstalledApps(call: PluginCall) {
        val context = context ?: run {
            call.reject("Context unavailable")
            return
        }

        try {
            val pm = context.packageManager
            val packages = pm.getInstalledPackages(0)
            val appsArray = JSArray()

            for (pkg in packages) {
                val appInfo = pkg.applicationInfo ?: continue
                val isSystem = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                val appName = pm.getApplicationLabel(appInfo).toString()
                val pkgName = pkg.packageName

                val obj = JSObject()
                obj.put("name", appName)
                obj.put("packageName", pkgName)
                obj.put("isSystem", isSystem)
                appsArray.put(obj)
            }

            val res = JSObject()
            res.put("apps", appsArray)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Failed to list installed apps", e)
        }
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_VPN_PERMISSION) {
            val savedCall = savedCall ?: return
            val ret = JSObject()
            ret.put("granted", resultCode == android.app.Activity.RESULT_OK)
            savedCall.resolve(ret)
        }
    }
}
