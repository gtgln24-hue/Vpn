package com.gln.tunnel.ssh

import android.util.Log
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import com.jcraft.jsch.SocketFactory
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.Socket
import java.util.Properties

class SshTunnelEngine(
    private val listener: SshEventListener,
    private val socketProtector: ((Socket) -> Boolean)? = null
) {
    interface SshEventListener {
        fun onSshLog(message: String, level: String = "info")
        fun onSshConnected(localSocksPort: Int)
        fun onSshDisconnected(reason: String)
        fun onSshError(error: String)
    }

    @Volatile
    private var jschSession: Session? = null

    @Volatile
    private var isRunning = false

    private val engineLock = Any()

    fun connect(
        host: String,
        port: Int = 22,
        user: String,
        password: String? = null,
        privateKeyPath: String? = null,
        passphrase: String? = null,
        socksPort: Int = 10808,
        enableCompression: Boolean = true,
        keepAliveIntervalSeconds: Int = 15
    ) {
        synchronized(engineLock) {
            if (isRunning) return
            isRunning = true
        }

        Thread {
            try {
                if (!isRunning) return@Thread
                listener.onSshLog("SSH Engine: Initializing JSch library with socket protection...", "info")
                val jsch = JSch()

                if (!privateKeyPath.isNullOrEmpty()) {
                    val keyFile = java.io.File(privateKeyPath)
                    if (keyFile.exists()) {
                        listener.onSshLog("SSH Engine: Loading identity private key [${keyFile.name}]...", "debug")
                        if (!passphrase.isNullOrEmpty()) {
                            jsch.addIdentity(privateKeyPath, passphrase)
                        } else {
                            jsch.addIdentity(privateKeyPath)
                        }
                    } else {
                        listener.onSshLog("SSH Engine: Key file not found at $privateKeyPath", "warning")
                    }
                }

                if (!isRunning) return@Thread
                listener.onSshLog("SSH Engine: Creating socket target $host:$port...", "info")
                val session = jsch.getSession(user, host, port)

                // Inject Custom Protected SocketFactory to prevent routing loops inside TUN
                session.setSocketFactory(object : SocketFactory {
                    override fun createSocket(host: String, port: Int): Socket {
                        val socket = Socket()
                        socketProtector?.let { protect ->
                            val protected = protect(socket)
                            if (protected) {
                                listener.onSshLog("SSH Engine: Successfully protected SSH Socket from TUN routing loop ✓", "debug")
                            } else {
                                listener.onSshLog("SSH Engine: Warning - Socket protection returned false", "warning")
                            }
                        }
                        socket.connect(java.net.InetSocketAddress(host, port), 15000)
                        return socket
                    }

                    override fun getInputStream(socket: Socket): InputStream = socket.getInputStream()
                    override fun getOutputStream(socket: Socket): OutputStream = socket.getOutputStream()
                })

                if (!password.isNullOrEmpty()) {
                    session.setPassword(password)
                }

                val config = Properties()
                config["StrictHostKeyChecking"] = "no"
                if (enableCompression) {
                    config["compression.s2c"] = "zlib@openssh.com,zlib,none"
                    config["compression.c2s"] = "zlib@openssh.com,zlib,none"
                }
                session.setConfig(config)
                session.setServerAliveInterval(keepAliveIntervalSeconds * 1000)
                session.timeout = 15000

                if (!isRunning) return@Thread
                listener.onSshLog("SSH Engine: Negotiating key exchange & cipher suites with $host...", "info")
                session.connect(15000)

                var shouldNotify = false
                synchronized(engineLock) {
                    if (!isRunning || !session.isConnected) {
                        try { session.disconnect() } catch (_: Exception) {}
                        if (isRunning) {
                            isRunning = false
                            listener.onSshError("SSH Connection failed during handshake.")
                        }
                        return@Thread
                    }

                    listener.onSshLog("SSH Engine: SSH Handshake & User Authentication Successful ✓", "success")
                    jschSession = session

                    listener.onSshLog("SSH Engine: Binding Dynamic SOCKS5 Proxy on 127.0.0.1:$socksPort...", "info")
                    session.setPortForwardingDyna("127.0.0.1", socksPort)

                    listener.onSshLog("SSH Engine: Dynamic SOCKS5 Proxy active on port $socksPort ✓", "success")
                    shouldNotify = true
                }

                if (shouldNotify) {
                    listener.onSshConnected(socksPort)
                }

            } catch (e: Exception) {
                Log.e("SshTunnelEngine", "SSH Connection error", e)
                synchronized(engineLock) {
                    isRunning = false
                    try { jschSession?.disconnect() } catch (_: Exception) {}
                    jschSession = null
                }
                listener.onSshError("SSH Connection Error: ${e.message ?: "Handshake or network timeout"}")
                disconnect("Connection Fault: ${e.message}")
            }
        }.start()
    }

    fun disconnect(reason: String = "User requested disconnect") {
        synchronized(engineLock) {
            if (!isRunning && jschSession == null) return
            isRunning = false
            try {
                listener.onSshLog("SSH Engine: Terminating SSH session and freeing local proxy port ($reason)...", "warning")
                jschSession?.disconnect()
            } catch (e: Exception) {
                Log.e("SshTunnelEngine", "Error closing SSH session", e)
            } finally {
                jschSession = null
            }
        }
        listener.onSshDisconnected(reason)
    }

    fun isConnected(): Boolean = isRunning && jschSession?.isConnected == true
}
