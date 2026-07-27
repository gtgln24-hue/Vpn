/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  TunnelProtocol,
  TunnelServer,
  PayloadConfig,
  TerminalLog,
  AppRule,
  AdvancedSettings,
  Profile,
} from './types';
import { SERVERS, INITIAL_APP_RULES, DEFAULT_SETTINGS } from './data';
import { vpnBridge } from './utils/capacitorVpnBridge';

import ServerList from './components/ServerList';
import PayloadGenerator from './components/PayloadGenerator';
import TerminalLogs from './components/TerminalLogs';
import SpeedTest from './components/SpeedTest';
import SplitTunneling from './components/SplitTunneling';
import TunnelSettings from './components/TunnelSettings';
import VisualChart from './components/VisualChart';
import QrScanner from './components/QrScanner';
import GlnConfigManager from './components/GlnConfigManager';
import NetworkUtilities from './components/NetworkUtilities';
import BatteryMonitor from './components/BatteryMonitor';

import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Settings,
  Activity,
  Terminal as TerminalIcon,
  Zap,
  Globe,
  Wifi,
  WifiOff,
  TrendingUp,
  RotateCcw,
  BookOpen,
  QrCode,
  FileSpreadsheet,
  Network,
  FileCode,
  Sliders,
  MessageSquare,
  Lock,
  RefreshCw,
  Calendar,
  X,
  Key,
  Menu,
} from 'lucide-react';

export default function App() {
  // Navigation & Connection State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payload' | 'split' | 'settings' | 'speedtest' | 'utilities' | 'ssh_settings' | 'ssh_keys' | 'logs'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [selectedProtocol, setSelectedProtocol] = useState<TunnelProtocol>('SSH');
  const [servers, setServers] = useState<TunnelServer[]>(SERVERS);
  const [selectedServer, setSelectedServer] = useState<TunnelServer>(SERVERS[0]);
  const [showQrScanner, setShowQrScanner] = useState<boolean>(false);
  const [showGlnManager, setShowGlnManager] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);
  const [bytesTransferred, setBytesTransferred] = useState<number>(342.1); // MB

  // Configuration States
  const [payloadConfig, setPayloadConfig] = useState<PayloadConfig>({
    method: 'CONNECT',
    bugHost: 'm.twitter.com',
    split: 'none',
    extraHeaders: {
      keepAlive: true,
      onlineHost: true,
      userAgent: true,
      referer: false,
      forwardHost: false,
    },
    customPayload: 'CONNECT [host_port] [protocol][crlf]Host: m.twitter.com[crlf]Connection: keep-alive[crlf][crlf]',
  });
  const [appRules, setAppRules] = useState<AppRule[]>(INITIAL_APP_RULES);
  const [splitTunnelMode, setSplitTunnelMode] = useState<'off' | 'include' | 'exclude'>('exclude');
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(DEFAULT_SETTINGS);

  // New Imported Config States
  const [homeMessage, setHomeMessage] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [layoutLocked, setLayoutLocked] = useState<boolean>(false);

  // Live traffic speeds (in KB/s)
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);

  // Terminal Syslog state
  const [logs, setLogs] = useState<TerminalLog[]>([]);

  // Local IP / Virtual IP Simulation
  const localIp = '192.168.1.104';
  const virtualIp = isConnected ? '10.42.0.15' : '—';

  // Helper to push syslog messages
  const pushLog = (message: string, type: TerminalLog['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(7),
      timestamp,
      type,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Run initial logs
  useEffect(() => {
    pushLog('OpenTunnel security agent initialized.', 'success');
    pushLog('ChaCha20-Poly1305 cryptographic module loaded successfully.', 'info');
    pushLog(`Default routing namespace configured to tunnel virtual interfaces.`, 'info');
    pushLog('Awaiting gateway handshake command.', 'warning');
  }, []);

  // Subscribe to Native VPN Bridge state, stats, and logs
  useEffect(() => {
    const unsubState = vpnBridge.subscribeState((state) => {
      if (state === 'CONNECTED') {
        setIsConnected(true);
        setIsConnecting(false);
      } else if (state === 'CONNECTING') {
        setIsConnecting(true);
        setIsConnected(false);
      } else if (state === 'DISCONNECTED') {
        setIsConnected(false);
        setIsConnecting(false);
        setUptimeSeconds(0);
      }
    });

    const unsubStats = vpnBridge.subscribeStats((stats) => {
      if (stats.isActive && stats.uptimeSeconds !== undefined) {
        setUptimeSeconds(stats.uptimeSeconds);
      }
    });

    const unsubLogs = vpnBridge.subscribeLogs((logEvent) => {
      pushLog(logEvent.message, logEvent.level);
    });

    vpnBridge.syncNativeStatus();

    return () => {
      unsubState();
      unsubStats();
      unsubLogs();
    };
  }, []);

  // Connection Handler
  const handleToggleConnection = () => {
    if (isConnected || isConnecting) {
      // Disconnecting process
      vpnBridge.stopVpn();
      setIsConnecting(false);
      setIsConnected(false);
      setUptimeSeconds(0);
      setDownloadSpeed(0);
      setUploadSpeed(0);
      pushLog('Closing local secure tunnel sockets...', 'warning');
      pushLog('Releasing virtual interface dev/utun0...', 'info');
      pushLog('DNS redirect tables restored to default carrier routing.', 'info');
      pushLog('INTERFACE DISCONNECTED', 'error');
    } else {
      // Validate configuration expiration first
      if (expiryDate && new Date() > new Date(expiryDate)) {
        pushLog('CRITICAL FAULT: Secure connection handshake rejected!', 'error');
        pushLog(`This configuration profile expired on ${new Date(expiryDate).toLocaleString()}.`, 'error');
        pushLog('Please obtain a newly compiled, valid .gln profile config file.', 'error');
        return;
      }

      // Prepare active split tunneling applications
      const activeAppsList = appRules.filter((r) => r.route).map((r) => r.packageName);

      const profile: Profile = {
        host: selectedServer.target || selectedServer.ip,
        port: selectedServer.ports?.[0] || 22,
        username: selectedServer.password ? 'vpnuser' : 'root',
        password: selectedServer.password,
        dnsPrimary: advancedSettings.dnsType === 'custom' ? advancedSettings.customDnsPrimary : '1.1.1.1',
        dnsSecondary: advancedSettings.dnsType === 'custom' ? advancedSettings.customDnsSecondary : '8.8.8.8',
        localSocksPort: advancedSettings.localPort || 10808,
        killSwitch: true,
        splitTunnelMode: splitTunnelMode,
        splitTunnelApps: activeAppsList,
        mtu: advancedSettings.mtu || 1420,
      };

      pushLog('Initializing secure tunnel gateway handshake sequence...', 'info');
      pushLog(`Protocol selected: ${selectedProtocol} (SOCKS5 Local: ${advancedSettings.localPort})`, 'debug');
      pushLog(`Configured Name Resolver: ${advancedSettings.dnsType === 'custom' ? advancedSettings.customDnsPrimary : advancedSettings.dnsType.toUpperCase()}`, 'debug');

      if (selectedServer.isCustomConfig) {
        pushLog(`[SSH SERVER] Target Endpoint: ${selectedServer.target || 'localhost:22'}`, 'info');
      } else {
        pushLog(`Target node: ${selectedServer.name} [${selectedServer.ip}]`, 'info');
      }

      vpnBridge.startVpn(profile);
    }
  };

  // Live traffic speed simulation while connected
  useEffect(() => {
    let speedInterval: NodeJS.Timeout;
    if (isConnected) {
      speedInterval = setInterval(() => {
        // Base speeds depend slightly on selected server load
        const loadFactor = (100 - selectedServer.load) / 100; // higher load = slower max speed
        const baseDl = 2000 + Math.random() * 8000 * loadFactor;
        const baseUl = 400 + Math.random() * 1600 * loadFactor;

        setDownloadSpeed(Math.round(baseDl));
        setUploadSpeed(Math.round(baseUl));

        // Increment bytes transferred slightly based on speed
        const chunkMB = (baseDl + baseUl) / 1024 / 2; // Simulated chunk size transferred in 500ms
        setBytesTransferred((prev) => parseFloat((prev + chunkMB / 1024).toFixed(3)));
      }, 500);
    } else {
      setDownloadSpeed(0);
      setUploadSpeed(0);
    }

    return () => {
      if (speedInterval) clearInterval(speedInterval);
    };
  }, [isConnected, selectedServer]);

  // Periodic syslog heartbeat reports
  useEffect(() => {
    let logInterval: NodeJS.Timeout;
    if (isConnected) {
      logInterval = setInterval(() => {
        const pingTime = Math.round(selectedServer.ping + Math.random() * 8 - 4);
        const rand = Math.random();
        if (rand < 0.2) {
          pushLog(`Heartbeat response received from gateway. Latency: ${pingTime}ms. Packet loss: 0%`, 'debug');
        } else if (rand < 0.3) {
          pushLog(`Optimizing network routing table. Frame synchronization synchronized.`, 'info');
        } else if (rand < 0.4) {
          // Dynamic calculation of active tunnel ratio
          const activeAppRoutesCount = appRules.filter(r => r.route).length;
          pushLog(`Split Tunnel Active: Routing ${activeAppRoutesCount} of ${appRules.length} applications securely.`, 'info');
        }
      }, 10000);
    }
    return () => {
      if (logInterval) clearInterval(logInterval);
    };
  }, [isConnected, selectedServer, appRules]);

  // Uptime ticker
  useEffect(() => {
    let ticker: NodeJS.Timeout;
    if (isConnected) {
      ticker = setInterval(() => {
        setUptimeSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [isConnected]);

  // Format uptime to hh:mm:ss
  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  };

  // Toggle app rules for split tunneling
  const handleToggleRule = (id: string) => {
    setAppRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = !r.route;
          pushLog(
            `Application '${r.name}' configured to ${updated ? 'Route through' : 'Bypass'} secure tunnel.`,
            updated ? 'success' : 'warning'
          );
          return { ...r, route: updated };
        }
        return r;
      })
    );
  };

  // Clear log wrapper
  const handleClearLogs = () => {
    setLogs([]);
    pushLog('Diagnostics and system log history purged.', 'warning');
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#050505] text-slate-300 font-sans flex flex-col p-4 md:p-6 select-none overflow-x-hidden">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-white/10 pb-4 gap-4">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Trigger Button */}
          <button
            id="menu-toggle-btn"
            onClick={() => setIsMenuOpen(true)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 transition-all cursor-pointer flex items-center justify-center"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            <Shield className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              gln tunnel <span className="text-emerald-400 font-bold">Pro</span>
            </h1>
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500 font-bold">
              Secure Gateway Protocol v4.2.0
            </p>
          </div>
        </div>

        {/* Global connection status bar */}
        <div className="flex flex-wrap items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Protocol Ingress</span>
              <span className="text-xs font-mono font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded mt-0.5">
                {selectedProtocol}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Global Latency</span>
              <span className={`text-xs font-mono font-bold mt-0.5 ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isConnected ? `${selectedServer.ping}ms` : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Protocol Selection Dropdown */}
            <select
              id="header-protocol-select"
              disabled={isConnected || isConnecting || layoutLocked}
              value={selectedProtocol}
              onChange={(e) => {
                setSelectedProtocol(e.target.value as TunnelProtocol);
                pushLog(`Set ingress tunneling protocol to ${e.target.value}.`, 'info');
              }}
              className="bg-white/5 border border-white/10 rounded-full text-xs font-semibold px-3 py-1.5 text-white hover:bg-white/10 transition-all outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="SSH">SSH Secure Shell</option>
              <option value="VMESS">VMess Secure</option>
              <option value="VLESS">VLESS Direct</option>
              <option value="TROJAN">Trojan GFW</option>
              <option value="SSH_WEBSOCKET">SSH Websocket CDN</option>
            </select>

            {/* Direct Connect Toggle */}
            <button
              id="btn-connection-toggle"
              onClick={handleToggleConnection}
              disabled={isConnecting}
              className={`px-6 py-1.5 rounded-full text-xs font-bold transition-all duration-300 shadow-md ${
                isConnected
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                  : isConnecting
                  ? 'bg-amber-500 text-black animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {isConnected ? 'CONNECTED' : isConnecting ? 'HANDSHAKING...' : 'CONNECT'}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          {/* Transparent Dark Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsMenuOpen(false)}
          ></div>

          {/* Drawer Panel Container */}
          <div className="relative flex flex-col w-full max-w-xs bg-[#0b0b0d] border-r border-white/10 h-full p-6 text-left shadow-2xl overflow-y-auto transition-transform duration-300 ease-out">
            {/* Header / Brand block inside Drawer */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <Shield className="w-5 h-5 text-black stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight text-white flex items-center gap-1">
                    gln tunnel <span className="text-emerald-400 font-bold">Pro</span>
                  </h2>
                  <p className="text-[8px] uppercase tracking-[0.15em] text-slate-500 font-mono font-black">
                    CONTROL CENTER
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/10"
                title="Close Navigation Drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 space-y-2">
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-600 font-black mb-3 px-2">
                Core Gateways
              </div>

              {/* Gateway Dashboard */}
              <button
                id="menu-tab-dashboard"
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Activity className="w-4.5 h-4.5 text-emerald-400" />
                <span>Gateway Dashboard</span>
              </button>

              {/* Split Tunneling */}
              <button
                id="menu-tab-split"
                onClick={() => {
                  setActiveTab('split');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'split'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Layers className="w-4.5 h-4.5 text-cyan-400" />
                <span>Split Tunneling</span>
              </button>

              {/* Payload Generator */}
              <button
                id="menu-tab-payload"
                onClick={() => {
                  setActiveTab('payload');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'payload'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_4px_20px_rgba(245,158,11,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Sliders className="w-4.5 h-4.5 text-amber-400" />
                <span>Payload Generator</span>
              </button>

              {/* Bandwidth Speedtest */}
              <button
                id="menu-tab-speedtest"
                onClick={() => {
                  setActiveTab('speedtest');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'speedtest'
                    ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-[0_4px_20px_rgba(236,72,153,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <TrendingUp className="w-4.5 h-4.5 text-pink-400" />
                <span>Bandwidth Speedtest</span>
              </button>

              <div className="pt-4 border-t border-white/5 my-2"></div>
              
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-600 font-black mb-3 px-2">
                Diagnostics & Core
              </div>

              {/* Diagnostics Toolkit */}
              <button
                id="menu-tab-utilities"
                onClick={() => {
                  setActiveTab('utilities');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'utilities'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_4px_20px_rgba(59,130,246,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Network className="w-4.5 h-4.5 text-blue-400" />
                <span>Diagnostics Toolkit</span>
              </button>

              {/* Advanced Settings */}
              <button
                id="menu-tab-settings"
                onClick={() => {
                  setActiveTab('settings');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_4px_20px_rgba(168,85,247,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Settings className="w-4.5 h-4.5 text-purple-400" />
                <span>Advanced Settings</span>
              </button>

              {/* Terminal Logs (Dedicated page!) */}
              <button
                id="menu-tab-logs"
                onClick={() => {
                  setActiveTab('logs');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-xs font-bold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_4px_20px_rgba(234,179,8,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <TerminalIcon className="w-4.5 h-4.5 text-yellow-400" />
                <span>System Logs & Trace</span>
              </button>
            </nav>

            {/* Quick status inside Drawer footer */}
            <div className="mt-auto border-t border-white/5 pt-4 space-y-1 bg-black/20 p-3 rounded-xl">
              <span className="text-[8px] font-mono font-bold text-slate-500 block uppercase tracking-wider">Active Channel</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-slate-600'}`}></span>
                <span className="text-xs font-bold text-slate-200">{isConnected ? 'SECURE TUNNEL ONLINE' : 'DISCONNECTED'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Workspace */}
      <main className="flex-1 grid grid-cols-12 gap-6 items-start">
        {/* Left column: Server Nodes List (Omnipresent on Dashboard layout for high-fidelity interactive flow) */}
        <section className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-6">
          {/* Handshake Trigger Options */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* QR Code Scanner Trigger */}
            <button
              id="btn-trigger-qr-scanner"
              onClick={() => setShowQrScanner(true)}
              className="flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 text-[11px] font-bold py-2.5 px-2 rounded-xl transition-all cursor-pointer group"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>QR Import</span>
            </button>

            {/* GLN Config Locker Trigger */}
            <button
              id="btn-trigger-gln-manager"
              onClick={() => setShowGlnManager(true)}
              className="flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/30 hover:border-blue-400 text-blue-400 text-[11px] font-bold py-2.5 px-2 rounded-xl transition-all cursor-pointer group"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span>.GLN Locker</span>
            </button>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5 overflow-hidden">
            <ServerList
              servers={servers}
              selectedServer={selectedServer}
              onSelect={(srv) => {
                if (layoutLocked) {
                  pushLog('Restriction: Cannot switch routing servers! Loaded .gln profile layout is Locked.', 'warning');
                  return;
                }
                setSelectedServer(srv);
                pushLog(`Selected routing node: ${srv.name}`, 'info');
              }}
              isConnected={isConnected}
              pushLog={pushLog}
            />
          </div>

          {/* Quick Stats Widget */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-emerald-500 rounded"></span> Cryptography Spec
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Cipher Protocol</span>
                <span className="font-mono text-emerald-400 font-semibold">ChaCha20-Poly1305</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Handshake</span>
                <span className="font-mono text-white">TLS v1.3 / SNI Spoof</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">UDP Bypass Port</span>
                <span className="font-mono text-cyan-400">7300 (UDPGW)</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">Frame Delivery</span>
                <span className="font-mono text-white">TCP Multiplex</span>
              </div>
            </div>
          </div>
        </section>

        {/* Center/Main workspace column based on active tab */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-12 gap-6">
              {/* Home broadcast message alert */}
              {homeMessage && (
                <div className="col-span-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start justify-between gap-4 animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-blue-400 font-mono font-black">Profile Creator Broadcast Message</span>
                      <p className="text-xs text-slate-200 mt-1 font-sans leading-relaxed font-semibold">{homeMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHomeMessage(null)}
                    className="text-slate-500 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                    title="Dismiss message"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Profile Expiration Warning */}
              {expiryDate && (
                <div className={`col-span-12 rounded-2xl p-4 flex items-start justify-between gap-4 animate-fade-in border ${
                  new Date() > new Date(expiryDate)
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      new Date() > new Date(expiryDate)
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-mono font-black">
                        {new Date() > new Date(expiryDate) ? 'Configuration Expired' : 'Configuration Validity Mark'}
                      </span>
                      <p className="text-xs text-slate-200 mt-1 font-sans leading-relaxed">
                        {new Date() > new Date(expiryDate) ? (
                          <strong className="text-rose-400 font-black">
                            CRITICAL: This configuration expired on {new Date(expiryDate).toLocaleString()}. Establish secure connection tunnel is disabled!
                          </strong>
                        ) : (
                          <span>This profile is valid and active. Expiration is set to: <strong className="font-bold text-emerald-400">{new Date(expiryDate).toLocaleString()}</strong>.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Layout Locked Read-Only Notice */}
              {layoutLocked && (
                <div className="col-span-12 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-mono font-black">Restricted Profile Protection</span>
                      <p className="text-xs text-slate-300 mt-0.5 leading-normal">
                        This configuration file is set to <strong className="text-amber-400">Read-Only mode</strong>. Advanced parameters, payload configs, and target gateways are frozen.
                      </p>
                    </div>
                  </div>
                  
                  {/* Reset/Clear Restrictions Button */}
                  <button
                    onClick={() => {
                      setLayoutLocked(false);
                      setHomeMessage(null);
                      setServerMessage(null);
                      setExpiryDate(null);
                      pushLog('Imported profile constraints cleared. Full configuration controls restored.', 'info');
                    }}
                    className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-400 text-rose-400 text-[10px] font-mono font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer shrink-0"
                    title="Unlock layout and restore custom settings"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Unlock Configuration</span>
                  </button>
                </div>
              )}

              {/* Immersive connection visualizer orb */}
              <div className="col-span-12 xl:col-span-5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.06),transparent_70%)]"></div>

                {/* Secure Connection ORB */}
                <div className="relative w-56 h-56 flex items-center justify-center">
                  {/* Outer spinning ring decorators */}
                  <div className={`absolute inset-0 border border-dashed rounded-full transition-all duration-1000 ${
                    isConnected ? 'border-emerald-500/30 animate-spin' : 'border-slate-800'
                  }`}></div>
                  <div className={`absolute inset-3 border rounded-full transition-all duration-500 ${
                    isConnected ? 'border-emerald-400/20 animate-reverse-spin' : 'border-slate-900'
                  }`}></div>
                  <div className={`absolute inset-6 border border-dotted rounded-full transition-all duration-700 ${
                    isConnected ? 'border-cyan-500/30 animate-spin' : 'border-slate-950'
                  }`}></div>

                  {/* Inner orb */}
                  <div className="w-36 h-36 rounded-full bg-[#070708] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center relative z-10">
                    <div className="text-3xl font-mono font-black text-white tracking-tight">
                      {isConnected ? bytesTransferred.toFixed(1) : isConnecting ? 'HAND' : '0.0'}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500 font-bold mt-1">
                      {isConnecting ? 'SHAKING...' : 'MB ROUTED'}
                    </div>

                    {/* Central tiny state status node */}
                    <div className={`absolute bottom-6 w-2.5 h-2.5 rounded-full ${
                      isConnected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-slate-700'
                    }`}></div>
                  </div>
                </div>

                <div className="mt-6 text-center z-10">
                  <p className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
                    {isConnected ? 'SECURE CHANNEL ACTIVE' : isConnecting ? 'VERIFYING ROUTE TRUST' : 'SECURE CHANNEL BYPASSED'}
                  </p>
                  <p className="text-sm font-semibold text-white mt-1 italic max-w-[240px] truncate">
                    {isConnected ? `tunnel.${selectedServer.id}.${selectedServer.country.toLowerCase()}` : 'unconfigured_gateway'}
                  </p>
                </div>
              </div>

              {/* Live Traffic Stream Visual Chart */}
              <div className="col-span-12 xl:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
                <VisualChart
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  uploadSpeed={uploadSpeed / 8} // Convert KB/s back to reasonable units for visual matching
                  downloadSpeed={downloadSpeed / 8}
                />
              </div>

              {/* Real-time Battery & Power Monitor Widget */}
              <div className="col-span-12">
                <BatteryMonitor
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  downloadSpeed={downloadSpeed}
                  uploadSpeed={uploadSpeed}
                  pushLog={pushLog}
                />
              </div>
            </div>
          )}

          {activeTab === 'payload' && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
              <PayloadGenerator
                config={payloadConfig}
                isLocked={layoutLocked}
                onChange={(cfg) => {
                  setPayloadConfig(cfg);
                  pushLog(`Payload Configuration Updated: SNI [${cfg.bugHost}] Compiled`, 'debug');
                }}
              />
            </div>
          )}

          {activeTab === 'split' && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
              <SplitTunneling
                rules={appRules}
                splitTunnelMode={splitTunnelMode}
                onChangeMode={(m) => {
                  setSplitTunnelMode(m);
                  pushLog(`Split Tunneling Mode changed to: ${m.toUpperCase()}`, 'info');
                }}
                onToggleRule={handleToggleRule}
                onSetAllRules={(routeState) => {
                  setAppRules((prev) => prev.map((r) => ({ ...r, route: routeState })));
                  pushLog(`Configured all apps to ${routeState ? 'Tunnel' : 'Bypass'} state.`, 'info');
                }}
                onUpdateRules={(newRules) => {
                  setAppRules(newRules);
                }}
                pushLog={pushLog}
              />
            </div>
          )}

          {activeTab === 'speedtest' && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
              <SpeedTest
                isConnected={isConnected}
                basePing={selectedServer.ping}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
              <TunnelSettings
                settings={advancedSettings}
                onChange={(stg) => {
                  setAdvancedSettings(stg);
                  pushLog(`Saved advanced core parameters: DNS resolvers changed to ${stg.dnsType}`, 'success');
                }}
                isConnected={isConnected}
                selectedProtocol={selectedProtocol}
              />
            </div>
          )}

          {activeTab === 'utilities' && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-0.5">
              <NetworkUtilities
                settings={advancedSettings}
                onChangeSettings={setAdvancedSettings}
                pushLog={pushLog}
                isConnected={isConnected}
                selectedServer={selectedServer}
                selectedProtocol={selectedProtocol}
              />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-xl border border-yellow-500/20 shadow-lg">
                    <TerminalIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white font-sans tracking-tight">System Logs & Diagnostics</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time socket messages, handshake details, and system traces.</p>
                  </div>
                </div>
              </div>
              <TerminalLogs
                logs={logs}
                onClear={handleClearLogs}
                isConnected={isConnected}
                isConnecting={isConnecting}
                onInjectLog={pushLog}
              />
            </div>
          )}
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="mt-auto flex flex-col md:flex-row items-start md:items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest border-t border-white/10 pt-4 gap-4">
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col">
            <span className="text-slate-600 font-bold mb-0.5">Local Interface IP</span>
            <span className="text-slate-300 font-mono">{localIp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 font-bold mb-0.5">Secure Virtual IP</span>
            <span className={`font-mono font-bold ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
              {virtualIp}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col text-left md:text-right">
            <span className="text-slate-600 font-bold mb-0.5">Tunnel Delivery Protocol</span>
            <span className="text-slate-300 font-mono">{selectedProtocol} // UDPGW 7300</span>
          </div>
          <div className="flex flex-col text-left md:text-right">
            <span className="text-slate-600 font-bold mb-0.5">Session Uptime</span>
            <span className={`font-mono font-bold ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
              {formatUptime(uptimeSeconds)}
            </span>
          </div>
        </div>
      </footer>

      {showQrScanner && (
        <QrScanner
          onImport={(newServer) => {
            const exists = servers.find((s) => s.ip === newServer.ip);
            if (!exists) {
              setServers((prev) => [...prev, newServer]);
            }
            setSelectedServer(newServer);
            pushLog(`Successfully imported secure node: ${newServer.name} (${newServer.ip})`, 'success');
            setShowQrScanner(false);
          }}
          onClose={() => {
            pushLog('QR configuration import sequence cancelled.', 'warning');
            setShowQrScanner(false);
          }}
        />
      )}

      {showGlnManager && (
        <GlnConfigManager
          currentProtocol={selectedProtocol}
          currentServer={selectedServer}
          currentPayload={payloadConfig}
          currentSettings={advancedSettings}
          onImport={(proto, srv, pay, sett, importedHomeMsg, importedServerMsg, importedExpiryDate, importedLayoutLocked) => {
            srv.locked = !!importedLayoutLocked;
            const exists = servers.find((s) => s.ip === srv.ip);
            if (!exists) {
              setServers((prev) => [...prev, srv]);
            }

            // Save custom config to gln_custom_servers list if it is custom
            if (srv.isCustomConfig) {
              try {
                const saved = localStorage.getItem('gln_custom_servers');
                const customList = saved ? JSON.parse(saved) : [];
                const existsInCustom = customList.find((s: any) => s.id === srv.id || s.ip === srv.ip);
                if (!existsInCustom) {
                  customList.push(srv);
                } else {
                  // Merge import data to existing custom node
                  Object.assign(existsInCustom, srv);
                }
                localStorage.setItem('gln_custom_servers', JSON.stringify(customList));
              } catch (e) {
                console.error('Failed to sync imported custom server to local list', e);
              }
            }

            setSelectedProtocol(proto);
            setSelectedServer(srv);
            setPayloadConfig(pay);
            setAdvancedSettings(sett);
            
            // Set new imported metadata states
            setHomeMessage(importedHomeMsg);
            setServerMessage(importedServerMsg);
            setExpiryDate(importedExpiryDate);
            setLayoutLocked(importedLayoutLocked);

            pushLog(`Successfully applied secure .GLN profile config: ${srv.name}`, 'success');
            if (importedHomeMsg) {
              pushLog(`Profile broadcast message loaded! Check Home screen.`, 'info');
            }
            if (importedExpiryDate) {
              pushLog(`Validity expiration set for: ${new Date(importedExpiryDate).toLocaleString()}`, 'warning');
            }
            if (importedLayoutLocked) {
              pushLog(`🔒 Profile is locked in Read-Only protection mode.`, 'warning');
            }
            setShowGlnManager(false);
          }}
          onClose={() => {
            pushLog('GLN configuration locker closed.', 'info');
            setShowGlnManager(false);
          }}
          pushLog={pushLog}
        />
      )}
    </div>
  );
}
