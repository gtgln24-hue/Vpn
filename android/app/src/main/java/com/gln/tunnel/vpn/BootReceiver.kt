package com.gln.tunnel.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d("BootReceiver", "GLN Tunnel boot event received: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON") {

            val prefs = context.getSharedPreferences("gln_vpn_prefs", Context.MODE_PRIVATE)
            val autoReconnectOnBoot = prefs.getBoolean("auto_reconnect_on_boot", false)

            if (autoReconnectOnBoot) {
                val host = prefs.getString("host", "") ?: ""
                val user = prefs.getString("user", "") ?: ""

                if (host.isNotBlank() && user.isNotBlank()) {
                    Log.i("BootReceiver", "Auto-reconnecting VPN on boot to $host:$user...")
                    val vpnIntent = Intent(context, GlnVpnService::class.java).apply {
                        action = GlnVpnService.ACTION_START_VPN
                        putExtra(GlnVpnService.EXTRA_HOST, host)
                        putExtra(GlnVpnService.EXTRA_PORT, prefs.getInt("port", 22))
                        putExtra(GlnVpnService.EXTRA_USER, user)
                        putExtra(GlnVpnService.EXTRA_PASS, prefs.getString("pass", null))
                        putExtra(GlnVpnService.EXTRA_KEY_PATH, prefs.getString("key_path", null))
                        putExtra(GlnVpnService.EXTRA_PASSPHRASE, prefs.getString("passphrase", null))
                        putExtra(GlnVpnService.EXTRA_DNS_PRIMARY, prefs.getString("dns_primary", "1.1.1.1"))
                        putExtra(GlnVpnService.EXTRA_DNS_SECONDARY, prefs.getString("dns_secondary", "8.8.8.8"))
                        putExtra(GlnVpnService.EXTRA_SOCKS_PORT, prefs.getInt("socks_port", 10808))
                        putExtra(GlnVpnService.EXTRA_MTU, prefs.getInt("mtu", 1420))
                        putExtra(GlnVpnService.EXTRA_KILL_SWITCH, prefs.getBoolean("kill_switch", true))
                    }

                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            context.startForegroundService(vpnIntent)
                        } else {
                            context.startService(vpnIntent)
                        }
                    } catch (e: Exception) {
                        Log.e("BootReceiver", "Failed to start GlnVpnService on boot", e)
                    }
                } else {
                    Log.w("BootReceiver", "Auto-reconnect on boot enabled, but missing valid host/user settings.")
                }
            }
        }
    }
}

