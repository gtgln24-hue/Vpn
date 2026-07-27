import React, { useState, useEffect } from 'react';
import { AppRule } from '../types';
import { vpnBridge } from '../utils/capacitorVpnBridge';
import {
  Layers,
  Shield,
  ShieldOff,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight,
  Info,
  Chrome,
  MessageSquare,
  Terminal,
  Play,
  Gamepad2,
  Smartphone,
  Cpu,
  Filter,
  X,
  Zap,
} from 'lucide-react';

interface SplitTunnelingProps {
  rules: AppRule[];
  splitTunnelMode: 'off' | 'include' | 'exclude';
  onChangeMode: (mode: 'off' | 'include' | 'exclude') => void;
  onToggleRule: (id: string) => void;
  onSetAllRules: (routeState: boolean) => void;
  onUpdateRules: (newRules: AppRule[]) => void;
  pushLog?: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

export default function SplitTunneling({
  rules,
  splitTunnelMode,
  onChangeMode,
  onToggleRule,
  onSetAllRules,
  onUpdateRules,
  pushLog,
}: SplitTunnelingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'user' | 'system' | 'routed' | 'bypassed'>('all');
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customAppName, setCustomAppName] = useState('');
  const [customPackageName, setCustomPackageName] = useState('');

  // Helper icon generator
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Globe':
        return <Chrome className="w-4 h-4 text-cyan-400" />;
      case 'MessageSquare':
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'Terminal':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case 'Play':
        return <Play className="w-4 h-4 text-pink-400" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-4 h-4 text-purple-400" />;
      case 'Smartphone':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-400" />;
    }
  };

  // Fetch / Scan installed apps from native bridge
  const handleScanInstalledApps = async () => {
    setIsLoadingApps(true);
    try {
      const apps = await vpnBridge.getInstalledApps();
      const existingMap = new Map(rules.map((r) => [r.packageName, r]));

      const mergedRules: AppRule[] = apps.map((app, index) => {
        const existing = existingMap.get(app.packageName);
        if (existing) {
          return {
            ...existing,
            isSystem: app.isSystem,
          };
        }

        let icon = 'Smartphone';
        const pkg = app.packageName.toLowerCase();
        if (pkg.includes('chrome') || pkg.includes('browser') || pkg.includes('firefox')) icon = 'Globe';
        else if (pkg.includes('youtube') || pkg.includes('netflix') || pkg.includes('media')) icon = 'Play';
        else if (pkg.includes('discord') || pkg.includes('whatsapp') || pkg.includes('telegram')) icon = 'MessageSquare';
        else if (pkg.includes('game') || pkg.includes('valorant') || pkg.includes('pubg')) icon = 'Gamepad2';
        else if (pkg.includes('terminal') || app.isSystem) icon = 'Terminal';

        return {
          id: `scanned-${index}-${app.packageName}`,
          name: app.name,
          packageName: app.packageName,
          icon,
          route: true,
          isSystem: app.isSystem,
        };
      });

      onUpdateRules(mergedRules);
      if (pushLog) pushLog(`Scanned ${mergedRules.length} device applications for Split Tunneling`, 'success');
    } catch (err) {
      console.error('Failed to scan installed apps', err);
      if (pushLog) pushLog('Failed to fetch installed applications from device bridge.', 'error');
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Handle adding custom app package
  const handleAddCustomApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAppName.trim() || !customPackageName.trim()) return;

    const newRule: AppRule = {
      id: `custom-${Date.now()}`,
      name: customAppName.trim(),
      packageName: customPackageName.trim().toLowerCase(),
      icon: 'Smartphone',
      route: true,
      isSystem: false,
    };

    onUpdateRules([newRule, ...rules]);
    setCustomAppName('');
    setCustomPackageName('');
    setShowAddCustom(false);
    if (pushLog) pushLog(`Added custom split tunneling rule for package [${newRule.packageName}]`, 'success');
  };

  // Preset buttons
  const handlePresetSelect = (presetType: 'browsers' | 'messengers' | 'media' | 'games') => {
    const newRules = rules.map((r) => {
      const pkg = r.packageName.toLowerCase();
      let match = false;
      if (presetType === 'browsers' && (pkg.includes('chrome') || pkg.includes('browser') || pkg.includes('firefox') || pkg.includes('opera'))) {
        match = true;
      } else if (presetType === 'messengers' && (pkg.includes('discord') || pkg.includes('whatsapp') || pkg.includes('telegram') || pkg.includes('signal'))) {
        match = true;
      } else if (presetType === 'media' && (pkg.includes('youtube') || pkg.includes('netflix') || pkg.includes('spotify') || pkg.includes('twitch'))) {
        match = true;
      } else if (presetType === 'games' && (pkg.includes('game') || pkg.includes('valorant') || pkg.includes('pubg') || pkg.includes('riot'))) {
        match = true;
      }
      return match ? { ...r, route: true } : r;
    });
    onUpdateRules(newRules);
  };

  // Filter rules
  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.packageName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterCategory === 'user') return !r.isSystem;
    if (filterCategory === 'system') return !!r.isSystem;
    if (filterCategory === 'routed') return r.route;
    if (filterCategory === 'bypassed') return !r.route;
    return true;
  });

  const routedCount = rules.filter((r) => r.route).length;
  const bypassedCount = rules.length - routedCount;

  return (
    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-5 md:p-6 space-y-6 text-slate-300">
      {/* Header & Status Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-sans tracking-tight">Application Split Tunneling</h2>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black">
                Per-App Firewall
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Control which apps route traffic through the encrypted VPN tunnel and which apps bypass it.
            </p>
          </div>
        </div>

        {/* Scan & Add Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            id="btn-scan-apps"
            onClick={handleScanInstalledApps}
            disabled={isLoadingApps}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Scan installed applications on device"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApps ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>{isLoadingApps ? 'Scanning...' : 'Scan Apps'}</span>
          </button>

          <button
            id="btn-add-custom-app"
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Package</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Cards */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500 block">
          Split Tunneling Mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Mode 1: Off */}
          <button
            id="mode-btn-off"
            onClick={() => onChangeMode('off')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              splitTunnelMode === 'off'
                ? 'bg-slate-800/80 border-slate-500 text-white shadow-lg shadow-black/40'
                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-sans">Disable Split Tunnel</span>
              {splitTunnelMode === 'off' && (
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Route <strong>ALL</strong> device traffic through the VPN. No application bypasses the tunnel.
            </p>
          </button>

          {/* Mode 2: Exclude Mode (Bypass) */}
          <button
            id="mode-btn-exclude"
            onClick={() => onChangeMode('exclude')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              splitTunnelMode === 'exclude'
                ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-lg shadow-amber-500/5'
                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold font-sans text-amber-400">Bypass Mode (Exclude)</span>
              </div>
              {splitTunnelMode === 'exclude' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Selected apps <strong>BYPASS</strong> the VPN (direct ISP connection). All other apps route via VPN.
            </p>
          </button>

          {/* Mode 3: Include Mode (Tunnel Only) */}
          <button
            id="mode-btn-include"
            onClick={() => onChangeMode('include')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              splitTunnelMode === 'include'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/5'
                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold font-sans text-emerald-400">Tunnel Mode (Allowlist)</span>
              </div>
              {splitTunnelMode === 'include' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              <strong>ONLY</strong> selected apps route through the VPN. All unselected apps connect directly.
            </p>
          </button>
        </div>
      </div>

      {/* Custom App Form Drawer / Dropdown */}
      {showAddCustom && (
        <form onSubmit={handleAddCustomApp} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" /> Add Custom Application Package
            </h4>
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">App Display Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Custom Banking App"
                value={customAppName}
                onChange={(e) => setCustomAppName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg text-xs px-3 py-2 text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Android Package Name</label>
              <input
                type="text"
                required
                placeholder="e.g. com.example.mybank"
                value={customPackageName}
                onChange={(e) => setCustomPackageName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg text-xs px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
            >
              Add Rule
            </button>
          </div>
        </form>
      )}

      {/* Info Banner explaining current active behavior */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          {splitTunnelMode === 'off' && (
            <span>
              Split tunneling is currently <strong className="text-white">Disabled</strong>. All applications automatically transmit through the encrypted VPN gateway tunnel.
            </span>
          )}
          {splitTunnelMode === 'exclude' && (
            <span>
              In <strong className="text-amber-400">Bypass Mode</strong>, apps toggled as <strong>Selected</strong> will bypass the VPN tunnel and connect directly via your local network interface. Unselected apps will remain encrypted.
            </span>
          )}
          {splitTunnelMode === 'include' && (
            <span>
              In <strong className="text-emerald-400">Tunnel Mode</strong>, <strong>ONLY</strong> apps toggled as Selected will route traffic through the VPN. All other apps on the device will bypass the tunnel.
            </span>
          )}
        </div>
      </div>

      {/* Search Bar & Presets Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or package..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {(['all', 'user', 'system', 'routed', 'bypassed'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions & Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetAllRules(true)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Select All
            </button>
            <button
              onClick={() => onSetAllRules(false)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Presets:</span>
            <button
              onClick={() => handlePresetSelect('browsers')}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded cursor-pointer"
            >
              Browsers
            </button>
            <button
              onClick={() => handlePresetSelect('messengers')}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded cursor-pointer"
            >
              Messaging
            </button>
            <button
              onClick={() => handlePresetSelect('media')}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded cursor-pointer"
            >
              Streaming
            </button>
            <button
              onClick={() => handlePresetSelect('games')}
              className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded cursor-pointer"
            >
              Games
            </button>
          </div>
        </div>
      </div>

      {/* Rules List Table */}
      <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-black/20">
        {filteredRules.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No matching applications found for query "{searchTerm}".
          </div>
        ) : (
          filteredRules.map((rule) => {
            // Calculate effective status based on splitTunnelMode
            let statusText = 'TUNNEL';
            let statusBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            let isBypassing = false;

            if (splitTunnelMode === 'off') {
              statusText = 'TUNNEL (ALL)';
              statusBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            } else if (splitTunnelMode === 'exclude') {
              if (rule.route) {
                statusText = 'BYPASS';
                statusBg = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                isBypassing = true;
              } else {
                statusText = 'TUNNEL';
                statusBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              }
            } else if (splitTunnelMode === 'include') {
              if (rule.route) {
                statusText = 'TUNNEL';
                statusBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              } else {
                statusText = 'BYPASS';
                statusBg = 'bg-slate-800 text-slate-500 border-slate-700';
                isBypassing = true;
              }
            }

            return (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl shrink-0">
                    {getIconComponent(rule.icon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-white truncate">{rule.name}</p>
                      {rule.isSystem && (
                        <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.2 rounded border border-white/5 shrink-0">
                          SYSTEM
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">{rule.packageName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border ${statusBg}`}
                  >
                    {isBypassing ? (
                      <>
                        <ShieldOff className="w-3 h-3" /> {statusText}
                      </>
                    ) : (
                      <>
                        <Shield className="w-3 h-3" /> {statusText}
                      </>
                    )}
                  </span>

                  <button
                    id={`btn-split-toggle-${rule.id}`}
                    onClick={() => onToggleRule(rule.id)}
                    className="cursor-pointer transition-transform active:scale-95"
                    title={rule.route ? 'Toggle Bypass / Off' : 'Toggle Tunnel / On'}
                  >
                    {rule.route ? (
                      <ToggleRight className="w-7 h-7 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Counters */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5 font-mono">
        <span>Total Registered Apps: {rules.length}</span>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400">Tunneling: {splitTunnelMode === 'off' ? rules.length : splitTunnelMode === 'include' ? routedCount : rules.length - routedCount}</span>
          <span className="text-amber-400">Bypassing: {splitTunnelMode === 'off' ? 0 : splitTunnelMode === 'include' ? bypassedCount : routedCount}</span>
        </div>
      </div>
    </div>
  );
}
