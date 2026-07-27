import React, { useState } from 'react';
import { TunnelServer } from '../types';
import { Server, Users, Activity, Check, Zap, Globe, Database, Plus, Trash2, X, Lock } from 'lucide-react';

interface ServerListProps {
  servers: TunnelServer[];
  selectedServer: TunnelServer;
  onSelect: (server: TunnelServer) => void;
  isConnected: boolean;
  pushLog?: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

// Conceptual coordinates on a 400x180 world grid map
const MAP_COORDINATES: Record<string, { x: number; y: number }> = {
  'sg-1': { x: 300, y: 120 },
  'sg-2': { x: 295, y: 125 },
  'us-west': { x: 80, y: 70 },
  'us-east': { x: 120, y: 65 },
  'eu-west': { x: 200, y: 55 },
  'eu-ams': { x: 195, y: 50 },
  'ap-tokyo': { x: 335, y: 75 },
  'ap-mumbai': { x: 270, y: 100 },
  // Country mapping for custom servers
  'India': { x: 270, y: 100 },
  'Singapore': { x: 300, y: 120 },
  'United States': { x: 100, y: 68 },
  'Germany': { x: 200, y: 55 },
  'Netherlands': { x: 195, y: 50 },
  'Japan': { x: 335, y: 75 },
  'Custom': { x: 200, y: 90 },
};

const COUNTRY_FLAGS: Record<string, string> = {
  'Singapore': '🇸🇬',
  'India': '🇮🇳',
  'United States': '🇺🇸',
  'Germany': '🇩🇪',
  'Netherlands': '🇳🇱',
  'Japan': '🇯🇵',
  'Custom': '🌐',
};

const COUNTRY_PINGS: Record<string, number> = {
  'Singapore': 28,
  'India': 45,
  'United States': 185,
  'Germany': 120,
  'Netherlands': 115,
  'Japan': 75,
  'Custom': 90,
};

export default function ServerList({
  servers,
  selectedServer,
  onSelect,
  isConnected,
  pushLog
}: ServerListProps) {
  // Client location: simulated South East Asia base coordinates
  const clientCoord = { x: 285, y: 115 }; 
  const activeServerCoord = MAP_COORDINATES[selectedServer.id] || MAP_COORDINATES[selectedServer.country] || { x: 200, y: 90 };

  // Server Type Switch State: Default vs Custom
  const [serverType, setServerType] = useState<'default' | 'custom'>(() => {
    return selectedServer.id.startsWith('custom-') ? 'custom' : 'default';
  });

  // Custom Servers State (local persistent)
  const [customServers, setCustomServers] = useState<TunnelServer[]>(() => {
    try {
      const saved = localStorage.getItem('gln_custom_servers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Add Custom Server Form States
  const [isAdding, setIsAdding] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [newServerName, setNewServerName] = useState('');

  // Custom SSH properties matching user interface
  const [newServerTarget, setNewServerTarget] = useState('localhost:22@username:password');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [newServerProxy, setNewServerProxy] = useState('localhost:8080');
  const [sniEnabled, setSniEnabled] = useState(false);
  const [newServerSni, setNewServerSni] = useState('');
  const [newServerPayload, setNewServerPayload] = useState('[method] [host_port] [protocol][crlf]Host: [host][crlf]Service: SSH[crlf]Mode: Bypass[crlf][crlf]');
  const [newServerCountry, setNewServerCountry] = useState('India');

  // VMess, VLess, Trojan specific options
  const [newServerCustomType, setNewServerCustomType] = useState<'SSH' | 'VMESS' | 'VLESS' | 'TROJAN'>('SSH');
  const [newServerUuid, setNewServerUuid] = useState('');
  const [newServerPassword, setNewServerPassword] = useState('');
  const [newServerNetwork, setNewServerNetwork] = useState<'tls' | 'websocket' | 'grpc'>('websocket');
  const [newServerTlsEnabled, setNewServerTlsEnabled] = useState(true);
  const [newServerMuxEnabled, setNewServerMuxEnabled] = useState(false);
  const [newServerPath, setNewServerPath] = useState('');
  const [newServerHeaderHost, setNewServerHeaderHost] = useState('');

  // Payload Generator Subpanel States (red box feature)
  const [showInlineGenerator, setShowInlineGenerator] = useState(false);
  const [genMethod, setGenMethod] = useState<'CONNECT' | 'GET' | 'POST' | 'PUT' | 'HEAD'>('CONNECT');
  const [genBugHost, setGenBugHost] = useState('m.twitter.com');
  const [genSplit, setGenSplit] = useState<'none' | 'normal' | 'instant_split' | 'delay_split'>('none');
  const [genKeepAlive, setGenKeepAlive] = useState(true);
  const [genOnlineHost, setGenOnlineHost] = useState(true);
  const [genUserAgent, setGenUserAgent] = useState(true);
  const [genReferer, setGenReferer] = useState(false);
  const [genForwardHost, setGenForwardHost] = useState(false);

  // Smart Ping States
  const [isPinging, setIsPinging] = useState(false);
  const [pingingServerId, setPingingServerId] = useState<string | null>(null);

  const activeServersList = serverType === 'default' ? servers : customServers;

  // Smart Ping Trigger Handler
  const handleSmartPing = () => {
    if (activeServersList.length === 0) {
      if (pushLog) pushLog('No servers available in this cluster to ping.', 'warning');
      return;
    }
    if (isConnected || isPinging) return;

    setIsPinging(true);
    if (pushLog) {
      pushLog(`Initializing Smart Ping gateway optimization sequence for ${serverType === 'default' ? 'Default' : 'Custom'} servers...`, 'info');
      pushLog('Tracing anycast network interface paths and calculating round-trip-time (RTT)...', 'debug');
    }

    let currentIdx = 0;
    
    const interval = setInterval(() => {
      if (currentIdx < activeServersList.length) {
        const currentServer = activeServersList[currentIdx];
        setPingingServerId(currentServer.id);
        
        if (pushLog) {
          pushLog(`Ping response from ${currentServer.name} [${currentServer.ip}]: latency = ${currentServer.ping}ms, load = ${currentServer.load}%`, 'debug');
        }
        
        currentIdx++;
      } else {
        clearInterval(interval);
        
        // Find the lowest latency server
        const bestServer = activeServersList.reduce((prev, curr) => (curr.ping < prev.ping ? curr : prev), activeServersList[0]);
        
        if (pushLog) {
          pushLog(`Smart Ping completed! Optimized route found: ${bestServer.name} with lowest latency of ${bestServer.ping}ms.`, 'success');
        }
        
        onSelect(bestServer);
        setIsPinging(false);
        setPingingServerId(null);
      }
    }, 250); // 250ms per node scanning delay
  };

  const handleGeneratePayload = () => {
    let result = '';
    const cleanHost = genBugHost.trim() || 'bug.com';

    if (genMethod === 'CONNECT') {
      result += `CONNECT [host_port] [protocol]`;
    } else {
      result += `${genMethod} http://${cleanHost}/ HTTP/1.1`;
    }

    if (genSplit === 'instant_split') {
      result += `[instant_split]`;
    } else if (genSplit === 'delay_split') {
      result += `[delay_split]`;
    }

    result += `[crlf]Host: ${cleanHost}[crlf]`;

    if (genKeepAlive) result += `Connection: keep-alive[crlf]`;
    if (genOnlineHost) result += `X-Online-Host: ${cleanHost}[crlf]`;
    if (genUserAgent) result += `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36[crlf]`;
    if (genReferer) result += `Referer: https://${cleanHost}/[crlf]`;
    if (genForwardHost) result += `X-Forward-Host: ${cleanHost}[crlf]`;

    result += `[crlf]`;
    setNewServerPayload(result);
    setShowInlineGenerator(false);
    if (pushLog) pushLog('Custom HTTP payload generated and injected.', 'success');
  };

  const handleSaveCustomServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerTarget.trim()) {
      if (pushLog) pushLog('Please enter both server name and target.', 'error');
      return;
    }

    const countryName = newServerCountry;
    const countryFlag = COUNTRY_FLAGS[countryName] || '🌐';
    const basePing = COUNTRY_PINGS[countryName] || 90;

    // Parse target e.g. "localhost:80" or "localhost:22@username:password"
    let hostIp = 'localhost';
    let portNum = 22;
    if (newServerCustomType === 'SSH') {
      const parts = newServerTarget.split('@');
      const hostPort = parts[0] || 'localhost:22';
      hostIp = hostPort.split(':')[0] || 'localhost';
      portNum = parseInt(hostPort.split(':')[1]) || 22;
    } else {
      const hostPort = newServerTarget.trim();
      hostIp = hostPort.split(':')[0] || 'localhost';
      portNum = parseInt(hostPort.split(':')[1]) || 80;
    }

    const serverData: TunnelServer = {
      id: editingServerId || `custom-${Date.now()}`,
      name: newServerName.trim(),
      country: countryName,
      flag: countryFlag,
      ip: hostIp,
      load: Math.floor(Math.random() * 25) + 10,
      ping: basePing,
      ports: [portNum],
      isCustomConfig: true,
      customType: newServerCustomType,
      target: newServerTarget.trim(),
      proxyEnabled: newServerCustomType === 'SSH' ? proxyEnabled : false,
      proxy: newServerCustomType === 'SSH' && proxyEnabled ? newServerProxy.trim() : undefined,
      sniEnabled: newServerCustomType === 'SSH' ? sniEnabled : (newServerTlsEnabled ? sniEnabled : false),
      sni: newServerCustomType === 'SSH' ? (sniEnabled ? newServerSni.trim() : undefined) : (newServerTlsEnabled && sniEnabled ? newServerSni.trim() : undefined),
      payload: newServerCustomType === 'SSH' ? newServerPayload.trim() : undefined,
      uuid: newServerCustomType !== 'SSH' && newServerCustomType !== 'TROJAN' ? newServerUuid.trim() : undefined,
      password: newServerCustomType === 'TROJAN' ? newServerPassword.trim() : undefined,
      network: newServerCustomType !== 'SSH' ? newServerNetwork : undefined,
      tlsEnabled: newServerCustomType !== 'SSH' ? newServerTlsEnabled : undefined,
      muxEnabled: newServerCustomType !== 'SSH' ? newServerMuxEnabled : undefined,
      path: newServerCustomType !== 'SSH' ? newServerPath.trim() : undefined,
      headerHost: newServerCustomType !== 'SSH' ? newServerHeaderHost.trim() : undefined,
      locked: false,
    };

    let updatedList: TunnelServer[];
    if (editingServerId) {
      updatedList = customServers.map((s) => (s.id === editingServerId ? serverData : s));
      if (pushLog) pushLog(`Custom server updated: ${serverData.name} (${newServerCustomType})`, 'success');
    } else {
      updatedList = [...customServers, serverData];
      if (pushLog) pushLog(`Custom server saved: ${serverData.name} (${newServerCustomType})`, 'success');
    }

    setCustomServers(updatedList);
    localStorage.setItem('gln_custom_servers', JSON.stringify(updatedList));

    // Select this server
    onSelect(serverData);

    // Reset fields
    resetForm();
  };

  const resetForm = () => {
    setNewServerName('');
    setNewServerTarget('localhost:22@username:password');
    setProxyEnabled(false);
    setNewServerProxy('localhost:8080');
    setSniEnabled(false);
    setNewServerSni('');
    setNewServerPayload('[method] [host_port] [protocol][crlf]Host: [host][crlf]Service: SSH[crlf]Mode: Bypass[crlf][crlf]');
    setNewServerCountry('India');
    setNewServerCustomType('SSH');
    setNewServerUuid('');
    setNewServerPassword('');
    setNewServerNetwork('websocket');
    setNewServerTlsEnabled(true);
    setNewServerMuxEnabled(false);
    setNewServerPath('');
    setNewServerHeaderHost('');
    setIsAdding(false);
    setEditingServerId(null);
    setShowInlineGenerator(false);
  };

  const handleEditServer = (srv: TunnelServer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) return;
    setEditingServerId(srv.id);
    setNewServerName(srv.name);
    setNewServerTarget(srv.target || `${srv.ip}:${srv.ports[0] || 22}@admin:admin`);
    setNewServerCountry(srv.country);
    
    // Set custom types and conditional states
    const cType = srv.customType || 'SSH';
    setNewServerCustomType(cType);
    
    if (cType === 'SSH') {
      setProxyEnabled(!!srv.proxyEnabled);
      setNewServerProxy(srv.proxy || 'localhost:8080');
      setSniEnabled(!!srv.sniEnabled);
      setNewServerSni(srv.sni || '');
      setNewServerPayload(srv.payload || '[method] [host_port] [protocol][crlf]Host: [host][crlf]Service: SSH[crlf]Mode: Bypass[crlf][crlf]');
    } else {
      setNewServerUuid(srv.uuid || '');
      setNewServerPassword(srv.password || '');
      setNewServerNetwork(srv.network || 'websocket');
      setNewServerTlsEnabled(srv.tlsEnabled !== undefined ? srv.tlsEnabled : true);
      setNewServerMuxEnabled(!!srv.muxEnabled);
      setNewServerPath(srv.path || '');
      setNewServerHeaderHost(srv.headerHost || '');
      setSniEnabled(!!srv.sniEnabled);
      setNewServerSni(srv.sni || '');
    }
    
    setIsAdding(true);
  };

  const handleDeleteServer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) return;

    const updated = customServers.filter((srv) => srv.id !== id);
    setCustomServers(updated);
    localStorage.setItem('gln_custom_servers', JSON.stringify(updated));

    if (selectedServer.id === id) {
      onSelect(servers[0]);
    }

    if (pushLog) {
      pushLog('Custom server removed from database.', 'warning');
    }
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-xl space-y-5 text-slate-300">
      
      {/* Header with smart ping controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <h3 className="font-sans font-semibold text-white text-sm">Cluster & Location Matrix</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSmartPing}
            disabled={isConnected || isPinging || activeServersList.length === 0}
            className={`flex items-center gap-1 text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              isConnected || activeServersList.length === 0
                ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
                : isPinging
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30'
            }`}
            title="Automatically select server with the lowest latency"
          >
            <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-bounce text-amber-500' : 'text-emerald-400'}`} />
            {isPinging ? 'ANALYZING...' : 'SMART PING'}
          </button>
          
          {!isPinging && (
            <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 hidden sm:inline-block">
              Anycast
            </span>
          )}
        </div>
      </div>

      {/* Default vs Custom Toggle Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/60 rounded-xl border border-white/5">
        <button
          onClick={() => {
            if (isPinging) return;
            setServerType('default');
          }}
          disabled={isConnected}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            serverType === 'default'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Default Server</span>
        </button>
        <button
          onClick={() => {
            if (isPinging) return;
            setServerType('custom');
          }}
          disabled={isConnected}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            serverType === 'custom'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Custom Server</span>
        </button>
      </div>

      {/* Cyber Grid Network Map */}
      <div className="relative h-44 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-10" />

        {/* Dynamic Connected Fiber Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Static dotted world map shapes (very minimal conceptual positions) */}
          <g className="fill-slate-800 opacity-20">
            {/* North America */}
            <circle cx="90" cy="65" r="14" />
            <circle cx="120" cy="75" r="10" />
            {/* Europe */}
            <circle cx="195" cy="55" r="12" />
            {/* Asia */}
            <circle cx="280" cy="90" r="18" />
            <circle cx="320" cy="80" r="12" />
            <circle cx="295" cy="120" r="10" />
            {/* Australia */}
            <circle cx="340" cy="140" r="8" />
          </g>

          {/* Connected Fiber laser line */}
          {isConnected && !isPinging && (
            <>
              {/* Glow background line */}
              <line
                x1={clientCoord.x}
                y1={clientCoord.y}
                x2={activeServerCoord.x}
                y2={activeServerCoord.y}
                className="stroke-emerald-500/30"
                strokeWidth="4"
              />
              {/* Sharp foreground line */}
              <line
                x1={clientCoord.x}
                y1={clientCoord.y}
                x2={activeServerCoord.x}
                y2={activeServerCoord.y}
                className="stroke-emerald-400"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                style={{ animation: 'dash 15s linear infinite' }}
              />
              <style>{`
                @keyframes dash {
                  to {
                    stroke-dashoffset: -100;
                  }
                }
              `}</style>
            </>
          )}

          {/* Client Node */}
          <circle cx={clientCoord.x} cy={clientCoord.y} r="4" className="fill-cyan-400 animate-ping" />
          <circle cx={clientCoord.x} cy={clientCoord.y} r="3" className="fill-cyan-400" />

          {/* Map Laser Horizontal Sweep Line during Smart Ping */}
          {isPinging && (
            <>
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="180"
                className="stroke-amber-500/60"
                strokeWidth="2"
                style={{
                  animation: 'sweep-horizontal 1.5s linear infinite',
                }}
              />
              <style>{`
                @keyframes sweep-horizontal {
                  0% { transform: translateX(0px); opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { transform: translateX(400px); opacity: 0; }
                }
              `}</style>
            </>
          )}

          {/* Active / Pinging Server Nodes */}
          {Object.entries(MAP_COORDINATES).map(([id, coord]) => {
            const isTarget = id === selectedServer.id || id === selectedServer.country;
            const isCurrentlyPinging = isPinging && (
              id === pingingServerId || 
              (activeServersList.find(s => s.id === pingingServerId)?.country === id)
            );
            return (
              <g key={id}>
                {isCurrentlyPinging && (
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="8"
                    className="fill-amber-400/30 stroke-amber-400/50 animate-ping"
                  />
                )}
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={isCurrentlyPinging ? "6" : isTarget ? "5" : "3.5"}
                  className={`transition-all duration-300 ${
                    isCurrentlyPinging
                      ? 'fill-amber-400 stroke-amber-500 stroke-2 font-bold scale-110'
                      : isTarget
                      ? isConnected
                        ? 'fill-emerald-400 stroke-emerald-900 stroke-2 animate-pulse'
                        : 'fill-amber-400 stroke-amber-900 stroke-2'
                      : 'fill-slate-700 hover:fill-slate-400 cursor-pointer'
                  }`}
                />
              </g>
            );
          })}
        </svg>

        {/* Map Overlays */}
        <div className="absolute top-3 left-3 flex flex-col gap-0.5">
          <span className="font-mono text-[9px] text-emerald-400 font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800/60 backdrop-blur-sm">
            GEO-PATH: {isPinging ? 'MEASURING NETWORK PATHS...' : selectedServer.country.toUpperCase()}
          </span>
          {isConnected && !isPinging && (
            <span className="font-mono text-[9px] text-cyan-400 font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800/60 backdrop-blur-sm w-fit mt-1">
              LATENCY: {selectedServer.ping}ms
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <div className="font-mono text-[9px] text-slate-500">
             {isPinging ? 'Smart Routing Engine Active' : `Jakarta Core → ${selectedServer.name}`}
          </div>
          <span className="font-mono text-[9px] text-slate-500 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800/60 backdrop-blur-sm">
            {isPinging ? 'SCANNING IP MATRIX' : `IP: ${selectedServer.ip}`}
          </span>
        </div>
      </div>

      {/* Server List Scroll Container / Form */}
      {serverType === 'custom' && isAdding ? (
        <form onSubmit={handleSaveCustomServer} className="bg-slate-950/80 border border-white/5 rounded-xl p-4 space-y-3.5 animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-300">
                {editingServerId ? 'Edit Custom Server' : 'Add Custom Server'}
              </span>
              <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase mt-0.5 tracking-tight">
                {newServerCustomType} Protocol Configured • performance mode
              </span>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">Server Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My private SG node"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1 font-sans">Protocol Type</label>
                <select
                  value={newServerCustomType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setNewServerCustomType(val);
                    if (val === 'SSH') {
                      setNewServerTarget('localhost:22@username:password');
                    } else {
                      setNewServerTarget('localhost:80');
                    }
                  }}
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="SSH">SSH</option>
                  <option value="VMESS">VMess</option>
                  <option value="VLESS">VLess</option>
                  <option value="TROJAN">Trojan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1 font-sans">Country Flag</label>
                <select
                  value={newServerCountry}
                  onChange={(e) => setNewServerCountry(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="India">India 🇮🇳</option>
                  <option value="Singapore">Singapore 🇸🇬</option>
                  <option value="United States">United States 🇺🇸</option>
                  <option value="Germany">Germany 🇩🇪</option>
                  <option value="Netherlands">Netherlands 🇳🇱</option>
                  <option value="Japan">Japan 🇯🇵</option>
                  <option value="Custom">Other 🌐</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1 font-sans">
                  {newServerCustomType === 'SSH' ? 'Target (host:port@user:pass)' : 'Target server (host:port)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newServerCustomType === 'SSH' ? 'localhost:22@user:pass' : 'localhost:80'}
                  value={newServerTarget}
                  onChange={(e) => setNewServerTarget(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* SSH specific fields */}
            {newServerCustomType === 'SSH' && (
              <>
                {/* Proxy Toggle Switch */}
                <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">proxy</span>
                    <button
                      type="button"
                      onClick={() => setProxyEnabled(!proxyEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        proxyEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          proxyEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {proxyEnabled && (
                    <input
                      type="text"
                      required={proxyEnabled}
                      placeholder="e.g. localhost:8080"
                      value={newServerProxy}
                      onChange={(e) => setNewServerProxy(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-mono animate-fade-in"
                    />
                  )}
                </div>

                {/* Server Name Indication Switch */}
                <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">server name indication</span>
                    <button
                      type="button"
                      onClick={() => setSniEnabled(!sniEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        sniEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          sniEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {sniEnabled && (
                    <input
                      type="text"
                      required={sniEnabled}
                      placeholder="e.g. m.twitter.com"
                      value={newServerSni}
                      onChange={(e) => setNewServerSni(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-mono animate-fade-in"
                    />
                  )}
                </div>

                {/* Payload & Generator red box highlight option */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500">payload</label>
                    
                    {/* Red outline surrounding Generator option to honor User Red Color Drawing request */}
                    <button
                      type="button"
                      onClick={() => setShowInlineGenerator(!showInlineGenerator)}
                      className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-950/30 hover:bg-red-950/50 border border-red-500/50 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                    >
                      <Zap className="w-3 h-3 text-red-400" />
                      <span>PAYLOAD GENERATE</span>
                    </button>
                  </div>

                  {/* Inline Generator Settings Panel (appears when clicked) */}
                  {showInlineGenerator && (
                    <div className="bg-slate-900 border border-red-500/30 rounded-lg p-3 space-y-2.5 animate-slide-up mb-2 text-[11px]">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1">
                        <span className="font-bold text-slate-300 font-sans text-[10px]">INJECTION GENERATOR parameters</span>
                        <button type="button" onClick={() => setShowInlineGenerator(false)} className="text-slate-400 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 block mb-1 font-bold">Request Method</span>
                          <select
                            value={genMethod}
                            onChange={(e) => setGenMethod(e.target.value as any)}
                            className="w-full text-[10px] bg-slate-950 border border-white/10 rounded p-1 text-white focus:outline-none focus:border-red-500 cursor-pointer"
                          >
                            <option value="CONNECT">CONNECT</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="HEAD">HEAD</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 block mb-1 font-bold">Bug Host</span>
                          <input
                            type="text"
                            value={genBugHost}
                            onChange={(e) => setGenBugHost(e.target.value)}
                            className="w-full text-[10px] bg-slate-950 border border-white/10 rounded p-1 text-white focus:outline-none focus:border-red-500 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 block mb-1 font-bold">Split Mode</span>
                        <select
                          value={genSplit}
                          onChange={(e) => setGenSplit(e.target.value as any)}
                          className="w-full text-[10px] bg-slate-950 border border-white/10 rounded p-1 text-white focus:outline-none focus:border-red-500 cursor-pointer"
                        >
                          <option value="none">No Split</option>
                          <option value="normal">Normal</option>
                          <option value="instant_split">Instant Split</option>
                          <option value="delay_split">Delay Split</option>
                        </select>
                      </div>

                      {/* Header toggles */}
                      <div className="grid grid-cols-2 gap-1 text-[10px] bg-slate-950/50 p-2 rounded border border-white/5">
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
                          <input type="checkbox" checked={genKeepAlive} onChange={(e) => setGenKeepAlive(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-white/10 w-3 h-3" />
                          <span>Keep-Alive</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
                          <input type="checkbox" checked={genOnlineHost} onChange={(e) => setGenOnlineHost(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-white/10 w-3 h-3" />
                          <span>Online Host</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none col-span-2">
                          <input type="checkbox" checked={genUserAgent} onChange={(e) => setGenUserAgent(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-white/10 w-3 h-3" />
                          <span>Spoof User-Agent</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
                          <input type="checkbox" checked={genReferer} onChange={(e) => setGenReferer(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-white/10 w-3 h-3" />
                          <span>Referer</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
                          <input type="checkbox" checked={genForwardHost} onChange={(e) => setGenForwardHost(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-white/10 w-3 h-3" />
                          <span>Forward-Host</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleGeneratePayload}
                        className="w-full bg-red-500 hover:bg-red-400 text-black text-[10px] font-black py-1.5 rounded transition-colors"
                      >
                        GENERATE & APPLY PAYLOAD
                      </button>
                    </div>
                  )}

                  <textarea
                    value={newServerPayload}
                    onChange={(e) => setNewServerPayload(e.target.value)}
                    placeholder="Paste payload or generate one using the options"
                    rows={3}
                    className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-mono resize-none leading-normal animate-fade-in"
                  />
                </div>
              </>
            )}

            {/* VMESS, VLESS, TROJAN specific fields */}
            {(newServerCustomType === 'VMESS' || newServerCustomType === 'VLESS' || newServerCustomType === 'TROJAN') && (
              <>
                {/* UUID or Password */}
                {newServerCustomType === 'TROJAN' ? (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">Trojan Password</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. trojan-password-key"
                      value={newServerPassword}
                      onChange={(e) => setNewServerPassword(e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">User UUID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. fd8289a0-9c2b-4fa2-bfcb-96cb341fa21c"
                      value={newServerUuid}
                      onChange={(e) => setNewServerUuid(e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}

                {/* Network type option selection */}
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">Network (Transport Type)</label>
                  <select
                    value={newServerNetwork}
                    onChange={(e) => setNewServerNetwork(e.target.value as any)}
                    className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                  >
                    <option value="websocket">Websocket (WS)</option>
                    <option value="grpc">gRPC</option>
                    <option value="tls">Direct TCP</option>
                  </select>
                </div>

                {/* TLS & Mux switches container */}
                <div className="grid grid-cols-2 gap-2">
                  {/* TLS Switch */}
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TLS</span>
                      <button
                        type="button"
                        onClick={() => setNewServerTlsEnabled(!newServerTlsEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          newServerTlsEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            newServerTlsEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <span className="text-[8px] text-slate-500 block">Transport Encryption</span>
                  </div>

                  {/* Mux Switch */}
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Mux</span>
                      <button
                        type="button"
                        onClick={() => setNewServerMuxEnabled(!newServerMuxEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          newServerMuxEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            newServerMuxEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <span className="text-[8px] text-slate-500 block">Multiplexing connection</span>
                  </div>
                </div>

                {/* Server Name Indication (SNI) - automatically hidden if TLS is disabled */}
                {newServerTlsEnabled && (
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">server name indication</span>
                      <button
                        type="button"
                        onClick={() => setSniEnabled(!sniEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          sniEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            sniEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    {sniEnabled && (
                      <input
                        type="text"
                        required={sniEnabled}
                        placeholder="e.g. sni.bug.com"
                        value={newServerSni}
                        onChange={(e) => setNewServerSni(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 font-mono animate-fade-in"
                      />
                    )}
                  </div>
                )}

                {/* Path and Header Host fields - shown for websocket/grpc */}
                {(newServerNetwork === 'websocket' || newServerNetwork === 'grpc') && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">Path</label>
                      <input
                        type="text"
                        placeholder="e.g. /gln-tunnel"
                        value={newServerPath}
                        onChange={(e) => setNewServerPath(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">Header Host</label>
                      <input
                        type="text"
                        placeholder="e.g. sub.bug.com"
                        value={newServerHeaderHost}
                        onChange={(e) => setNewServerHeaderHost(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold py-2 rounded-lg transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                // Reset form to default edits
                setNewServerName('');
                setNewServerTarget(newServerCustomType === 'SSH' ? 'localhost:22@username:password' : 'localhost:80');
                setProxyEnabled(false);
                setNewServerProxy('localhost:8080');
                setSniEnabled(false);
                setNewServerSni('');
                setNewServerPayload('[method] [host_port] [protocol][crlf]Host: [host][crlf]Service: SSH[crlf]Mode: Bypass[crlf][crlf]');
                setNewServerUuid('');
                setNewServerPassword('');
                setNewServerNetwork('websocket');
                setNewServerTlsEnabled(true);
                setNewServerMuxEnabled(false);
                setNewServerPath('');
                setNewServerHeaderHost('');
                if (pushLog) pushLog('Custom config editing fields reset to defaults.', 'warning');
              }}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold py-2 rounded-lg transition-colors cursor-pointer text-center border border-red-500/20"
              title="Reset all form inputs to default values"
            >
              Reset Edits
            </button>
            <button
              type="submit"
              className="flex-1 bg-purple-500 hover:bg-purple-400 text-black text-xs font-black py-2 rounded-lg transition-all cursor-pointer shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] text-center"
            >
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-left">
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {serverType === 'custom' && customServers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-950/40 border border-dashed border-white/10 rounded-xl">
                <Database className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs font-bold text-slate-300">No Custom Servers</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                  Configure your own private server node to route traffic.
                </p>
              </div>
            ) : (
              activeServersList.map((server) => {
                const isSelected = server.id === selectedServer.id;
                const isCurrentlyPinging = isPinging && server.id === pingingServerId;
                return (
                  <div
                    key={server.id}
                    id={`server-row-${server.id}`}
                    role="button"
                    tabIndex={isConnected || isPinging ? -1 : 0}
                    onClick={() => !(isConnected || isPinging) && onSelect(server)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        !(isConnected || isPinging) && onSelect(server);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isCurrentlyPinging
                        ? 'bg-amber-500/10 border-amber-500/30 text-white ring-2 ring-amber-500/10 scale-[1.01]'
                        : isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white ring-2 ring-emerald-500/10'
                        : 'bg-slate-950/40 border-white/5 hover:border-white/10 text-slate-400 hover:text-white'
                    } ${isConnected ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${isPinging ? 'cursor-wait' : ''} select-none`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl select-none" role="img" aria-label={server.country}>
                        {server.flag}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-sans font-semibold text-xs text-white">{server.name}</p>
                          {server.isCustomConfig && (
                            <span className="text-[7px] font-mono font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 py-0.2 rounded uppercase">
                              SSH
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Activity className={`w-3 h-3 ${isCurrentlyPinging ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                            {server.ping}ms
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            {server.load}% load
                          </span>
                          {server.isCustomConfig && (
                            <>
                              {server.proxyEnabled && (
                                <span className="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">PRX</span>
                              )}
                              {server.sniEnabled && (
                                <span className="text-[8px] text-cyan-400 font-bold bg-cyan-500/10 px-1 rounded">SNI</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCurrentlyPinging ? (
                        <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded animate-pulse">
                          RTT...
                        </span>
                      ) : isSelected ? (
                        <span className="bg-emerald-500 text-black rounded-full p-0.5">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      ) : null}

                      {/* Edit button for custom servers */}
                      {serverType === 'custom' && !isConnected && (
                        server.locked ? (
                          <div className="p-1.5 text-amber-500 bg-amber-500/10 rounded" title="Locked profile (Read-Only)">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleEditServer(server, e)}
                            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-all cursor-pointer"
                            title="Edit server settings"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )
                      )}

                      {/* Delete button for custom servers */}
                      {serverType === 'custom' && !isConnected && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteServer(server.id, e)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                          title="Remove server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add custom server trigger button */}
          {serverType === 'custom' && (
            <button
              onClick={() => setIsAdding(true)}
              disabled={isConnected}
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer ${
                isConnected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Add Custom Server Node</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
