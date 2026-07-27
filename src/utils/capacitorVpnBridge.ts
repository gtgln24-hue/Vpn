import { Profile } from '../types';

export interface VpnLogEvent {
  message: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  timestamp: number;
}

export interface VpnStatsEvent {
  uptimeSeconds: number;
  host?: string;
  isActive: boolean;
}

type VpnStateCallback = (state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING') => void;
type VpnLogCallback = (log: VpnLogEvent) => void;
type VpnStatsCallback = (stats: VpnStatsEvent) => void;

class CapacitorVpnBridge {
  private stateListeners: Set<VpnStateCallback> = new Set();
  private logListeners: Set<VpnLogCallback> = new Set();
  private statsListeners: Set<VpnStatsCallback> = new Set();
  private currentState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' = 'DISCONNECTED';
  private processedLogs: Set<string> = new Set();
  private pollInterval: any = null;

  constructor() {
    this.checkNativePlugin();
    this.setupLifecycleListeners();
  }

  public isNativeAndroid(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).Capacitor !== undefined &&
      (window as any).Capacitor.isNativePlatform()
    );
  }

  private setupLifecycleListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.syncNativeStatus());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.syncNativeStatus();
        }
      });
    }

    if (this.isNativeAndroid()) {
      this.pollInterval = setInterval(() => {
        this.syncNativeStatus();
      }, 3000);
    }
  }

  private checkNativePlugin() {
    if (this.isNativeAndroid()) {
      const capacitor = (window as any).Capacitor;
      const GlnVpn = capacitor.Plugins.GlnVpn;

      if (GlnVpn) {
        GlnVpn.addListener('vpnStatusChange', (data: { status: string; message: string; isActive: boolean; uptimeSeconds?: number; host?: string }) => {
          if (data.isActive || data.status === 'Connected') {
            this.notifyState('CONNECTED');
            if (data.uptimeSeconds !== undefined) {
              this.notifyStats({ uptimeSeconds: data.uptimeSeconds, host: data.host, isActive: true });
            }
          } else if (data.status === 'Connecting' || data.status === 'Reconnecting') {
            this.notifyState('CONNECTING');
          } else if (data.status === 'Disconnected') {
            this.notifyState('DISCONNECTED');
            this.notifyStats({ uptimeSeconds: 0, isActive: false });
          } else if (data.status === 'Error') {
            this.notifyState('DISCONNECTED');
            this.notifyStats({ uptimeSeconds: 0, isActive: false });
            this.notifyLog({
              message: `Native Engine Error: ${data.message}`,
              level: 'error',
              timestamp: Date.now(),
            });
          }

          this.notifyLog({
            message: `[Native VpnService] ${data.status}: ${data.message}`,
            level: data.status === 'Error' ? 'error' : data.status === 'Connected' ? 'success' : 'info',
            timestamp: Date.now(),
          });
        });

        GlnVpn.addListener('vpnLogEvent', (data: { message: string; level: 'info' | 'success' | 'warning' | 'error' | 'debug'; timestamp: number }) => {
          if (data && data.message) {
            this.notifyLog({
              message: data.message,
              level: data.level || 'info',
              timestamp: data.timestamp || Date.now(),
            });
          }
        });

        // Query initial status on load
        this.syncNativeStatus();
      }
    }
  }

  public async syncNativeStatus(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      const capacitor = (window as any).Capacitor;
      const GlnVpn = capacitor.Plugins.GlnVpn;
      if (GlnVpn && GlnVpn.getVpnStatus) {
        const res = await GlnVpn.getVpnStatus();
        if (res) {
          const isActive = res.isActive === true;
          if (isActive) {
            this.notifyState('CONNECTED');
            if (res.uptimeSeconds !== undefined) {
              this.notifyStats({ uptimeSeconds: res.uptimeSeconds, host: res.host, isActive: true });
            }
          } else if (res.status === 'Connecting' || res.status === 'Reconnecting') {
            this.notifyState('CONNECTING');
          } else {
            if (this.currentState === 'CONNECTED' || this.currentState === 'CONNECTING') {
              this.notifyState('DISCONNECTED');
              this.notifyStats({ uptimeSeconds: 0, isActive: false });
            }
          }

          if (res.logs && Array.isArray(res.logs)) {
            res.logs.forEach((log: any) => {
              const key = `${log.timestamp}-${log.message}`;
              if (!this.processedLogs.has(key)) {
                this.processedLogs.add(key);
                this.notifyLog({
                  message: log.message,
                  level: log.level || 'info',
                  timestamp: log.timestamp || Date.now(),
                });
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Error syncing native VPN status:', e);
    }
  }

  public subscribeState(callback: VpnStateCallback): () => void {
    this.stateListeners.add(callback);
    callback(this.currentState);
    return () => this.stateListeners.delete(callback);
  }

  public subscribeLogs(callback: VpnLogCallback): () => void {
    this.logListeners.add(callback);
    return () => this.logListeners.delete(callback);
  }

  public subscribeStats(callback: VpnStatsCallback): () => void {
    this.statsListeners.add(callback);
    return () => this.statsListeners.delete(callback);
  }

  private notifyState(state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING') {
    this.currentState = state;
    this.stateListeners.forEach((cb) => cb(state));
  }

  private notifyLog(event: VpnLogEvent) {
    this.logListeners.forEach((cb) => cb(event));
  }

  private notifyStats(stats: VpnStatsEvent) {
    this.statsListeners.forEach((cb) => cb(stats));
  }

  public async prepareVpnPermission(): Promise<boolean> {
    if (!this.isNativeAndroid()) return true;
    try {
      const capacitor = (window as any).Capacitor;
      const GlnVpn = capacitor.Plugins.GlnVpn;
      if (GlnVpn) {
        const res = await GlnVpn.prepareVpnPermission();
        return res?.granted === true;
      }
    } catch (e) {
      console.error('Error preparing VPN permission:', e);
    }
    return false;
  }

  public async isBatteryOptimizationIgnored(): Promise<boolean> {
    if (!this.isNativeAndroid()) return true;
    try {
      const capacitor = (window as any).Capacitor;
      const GlnVpn = capacitor.Plugins.GlnVpn;
      if (GlnVpn && GlnVpn.isBatteryOptimizationIgnored) {
        const res = await GlnVpn.isBatteryOptimizationIgnored();
        return res?.isIgnoring === true;
      }
    } catch (e) {
      console.error('Error checking battery optimization ignore status:', e);
    }
    return false;
  }

  public async requestBatteryOptimizationIgnore(): Promise<boolean> {
    if (!this.isNativeAndroid()) return true;
    try {
      const capacitor = (window as any).Capacitor;
      const GlnVpn = capacitor.Plugins.GlnVpn;
      if (GlnVpn) {
        const res = await GlnVpn.requestBatteryOptimizationIgnore();
        return res?.isIgnoring === true;
      }
    } catch (e) {
      console.error('Error requesting battery optimization ignore:', e);
    }
    return false;
  }

  public async getInstalledApps(): Promise<Array<{ name: string; packageName: string; isSystem?: boolean }>> {
    if (this.isNativeAndroid()) {
      try {
        const capacitor = (window as any).Capacitor;
        const GlnVpn = capacitor.Plugins.GlnVpn;
        if (GlnVpn && GlnVpn.getInstalledApps) {
          const res = await GlnVpn.getInstalledApps();
          if (res && res.apps && Array.isArray(res.apps)) {
            return res.apps;
          }
        }
      } catch (err) {
        console.error('Error fetching native installed apps:', err);
      }
    }
    return [
      { name: 'Google Chrome', packageName: 'com.android.chrome', isSystem: false },
      { name: 'WhatsApp Messenger', packageName: 'com.whatsapp', isSystem: false },
      { name: 'YouTube', packageName: 'com.google.android.youtube', isSystem: false },
      { name: 'Telegram', packageName: 'org.telegram.messenger', isSystem: false },
      { name: 'Netflix', packageName: 'com.netflix.mediaclient', isSystem: false },
      { name: 'Spotify', packageName: 'com.spotify.music', isSystem: false },
      { name: 'Instagram', packageName: 'com.instagram.android', isSystem: false },
      { name: 'Terminal / SSH Client', packageName: 'com.gln.terminal', isSystem: true },
      { name: 'System Web Browser', packageName: 'org.mozilla.firefox', isSystem: false },
      { name: 'Discord', packageName: 'com.discord', isSystem: false },
    ];
  }

  public async startVpn(profile: Profile): Promise<boolean> {
    if (this.currentState === 'CONNECTED' || this.currentState === 'CONNECTING') {
      return false;
    }

    if (this.isNativeAndroid()) {
      try {
        const capacitor = (window as any).Capacitor;
        const GlnVpn = capacitor.Plugins.GlnVpn;

        if (GlnVpn) {
          // Prepare system permissions first
          const permGranted = await this.prepareVpnPermission();
          if (!permGranted) {
            this.notifyLog({
              message: 'VPN Permission denied or dialog dismissed by user.',
              level: 'warning',
              timestamp: Date.now(),
            });
            return false;
          }

          this.notifyState('CONNECTING');
          this.notifyLog({
            message: `Starting Native SSH Tunnel Service to ${profile.host}:${profile.port}...`,
            level: 'info',
            timestamp: Date.now(),
          });

          await GlnVpn.startVpn({
            host: profile.host,
            port: profile.port,
            user: profile.username,
            password: profile.password,
            privateKeyPath: profile.privateKeyPath,
            passphrase: profile.privateKeyPassphrase,
            dnsPrimary: profile.dnsPrimary || '1.1.1.1',
            dnsSecondary: profile.dnsSecondary || '8.8.8.8',
            socksPort: profile.localSocksPort || 10808,
            killSwitch: profile.killSwitch !== false,
            allowedApps: profile.splitTunnelMode === 'include' ? profile.splitTunnelApps : [],
            disallowedApps: profile.splitTunnelMode === 'exclude' ? profile.splitTunnelApps : [],
            mtu: profile.mtu || 1420,
          });

          return true;
        }
      } catch (err: any) {
        this.notifyState('DISCONNECTED');
        this.notifyLog({
          message: `Native VpnService Failure: ${err.message || 'Plugin invocation error'}`,
          level: 'error',
          timestamp: Date.now(),
        });
        return false;
      }
    }

    // Web Preview High-Fidelity Simulation
    this.notifyState('CONNECTING');
    this.runWebSimulation(profile);
    return true;
  }

  private simulationTimers: any[] = [];

  private clearSimulationTimers() {
    this.simulationTimers.forEach((t) => clearTimeout(t));
    this.simulationTimers = [];
  }

  public async stopVpn(): Promise<void> {
    this.clearSimulationTimers();
    if (this.isNativeAndroid()) {
      try {
        const capacitor = (window as any).Capacitor;
        const GlnVpn = capacitor.Plugins.GlnVpn;
        if (GlnVpn) {
          await GlnVpn.stopVpn();
          return;
        }
      } catch (err: any) {
        console.error('Error stopping native VPN:', err);
      }
    }

    // Web Simulation Disconnect
    this.notifyState('DISCONNECTING');
    this.notifyLog({
      message: 'VPN Service: Initiating graceful shutdown sequence...',
      level: 'warning',
      timestamp: Date.now(),
    });

    const timer = setTimeout(() => {
      this.notifyLog({
        message: 'SSH Engine: Closing session & releasing socket handles.',
        level: 'info',
        timestamp: Date.now(),
      });
      this.notifyLog({
        message: 'tun2socks Engine: Closed TUN interface fd.',
        level: 'info',
        timestamp: Date.now(),
      });
      this.notifyState('DISCONNECTED');
      this.notifyLog({
        message: 'VPN Service: Disconnected. Carrier routing restored.',
        level: 'info',
        timestamp: Date.now(),
      });
    }, 600);
    this.simulationTimers.push(timer);
  }

  private runWebSimulation(profile: Profile) {
    this.clearSimulationTimers();
    const steps: Array<{ delay: number; log: VpnLogEvent; state?: 'CONNECTING' | 'CONNECTED' }> = [
      {
        delay: 200,
        log: {
          message: `[Native VpnService] Requesting TUN Interface allocation (MTU=${profile.mtu || 1420})...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 500,
        log: {
          message: `[Native VpnService] TUN interface created (fd=38, Virtual IP: 10.0.0.1/24, IPv6: fd00:1:2:3::1/64).`,
          level: 'success',
          timestamp: Date.now(),
        },
      },
      {
        delay: 700,
        log: {
          message: profile.splitTunnelMode === 'include'
            ? `[Split Tunneling] Mode: ALLOWLIST (Tunnel ONLY ${profile.splitTunnelApps?.length || 0} selected apps)`
            : profile.splitTunnelMode === 'exclude'
            ? `[Split Tunneling] Mode: BYPASS (Direct ISP for ${profile.splitTunnelApps?.length || 0} excluded apps)`
            : `[Split Tunneling] Mode: OFF (Routing ALL system & user apps through VPN)`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 900,
        log: {
          message: `[SSH Engine] Protecting socket and resolving ${profile.host}:${profile.port}...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 1400,
        log: {
          message: `[SSH Engine] Connected to SSH server! Negotiating ciphers (chacha20-poly1305@openssh.com, curve25519-sha256)...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 1900,
        log: {
          message: profile.privateKey
            ? `[SSH Engine] Authenticating user '${profile.username}' with RSA/Ed25519 Private Key...`
            : `[SSH Engine] Authenticating user '${profile.username}' with Password...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 2400,
        log: {
          message: `[SSH Engine] Handshake & Authentication Successful ✓`,
          level: 'success',
          timestamp: Date.now(),
        },
      },
      {
        delay: 2800,
        log: {
          message: `[SSH Engine] Binding Dynamic SOCKS5 Proxy on 127.0.0.1:${profile.localSocksPort || 10808}...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 3200,
        log: {
          message: `[tun2socks Router] Mapping Android TUN fd to local SOCKS5 proxy (127.0.0.1:${profile.localSocksPort || 10808})...`,
          level: 'info',
          timestamp: Date.now(),
        },
      },
      {
        delay: 3600,
        state: 'CONNECTED',
        log: {
          message: `[GLN Tunnel Pro] Connection Fully Established! All device traffic routed securely. ✓`,
          level: 'success',
          timestamp: Date.now(),
        },
      },
    ];

    steps.forEach((step) => {
      const timer = setTimeout(() => {
        if (this.currentState === 'CONNECTING' || this.currentState === 'CONNECTED') {
          if (step.state) {
            this.notifyState(step.state);
          }
          this.notifyLog(step.log);
        }
      }, step.delay);
      this.simulationTimers.push(timer);
    });
  }
}

export const vpnBridge = new CapacitorVpnBridge();
