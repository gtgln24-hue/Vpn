import { AdvancedSettings } from '../types';
import { Sliders, HelpCircle, ShieldAlert, Cpu } from 'lucide-react';

interface TunnelSettingsProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
  isConnected: boolean;
  selectedProtocol: string;
}

export default function TunnelSettings({ settings, onChange, isConnected, selectedProtocol }: TunnelSettingsProps) {
  const handleDnsTypeChange = (type: AdvancedSettings['dnsType']) => {
    let primary = '1.1.1.1';
    let secondary = '1.0.0.1';

    if (type === 'google') {
      primary = '8.8.8.8';
      secondary = '8.8.4.4';
    } else if (type === 'adguard') {
      primary = '94.140.14.14';
      secondary = '94.140.15.15';
    } else if (type === 'custom') {
      primary = settings.customDnsPrimary;
      secondary = settings.customDnsSecondary;
    }

    onChange({
      ...settings,
      dnsType: type,
      customDnsPrimary: primary,
      customDnsSecondary: secondary,
    });
  };

  return (
    <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h3 className="font-sans font-bold text-white text-sm">Advanced Core Settings</h3>
        </div>
        <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
          Proxy & DNS Core
        </span>
      </div>

      {isConnected && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex gap-3 animate-fade-in">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-normal">
            Advanced parameters are locked while the tunnel is actively connected. Disconnect to modify port binding, MTU size, or nameserver configurations.
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* DNS selection */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
            DNS Resolver Routing
            <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" title="Choose which DNS server handles nameserver lookups" />
          </label>
          <select
            id="dns-type-select"
            value={settings.dnsType}
            onChange={(e) => handleDnsTypeChange(e.target.value as any)}
            className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono cursor-pointer"
          >
            <option value="cloudflare" className="bg-[#0f0f12] text-white">Cloudflare Secure DNS (1.1.1.1)</option>
            <option value="google" className="bg-[#0f0f12] text-white">Google Public DNS (8.8.8.8)</option>
            <option value="adguard" className="bg-[#0f0f12] text-white">AdGuard AdBlocker DNS (94.140.14.14)</option>
            <option value="custom" className="bg-[#0f0f12] text-white">Custom Specified DNS</option>
          </select>
        </div>

        {/* Custom DNS input fields */}
        {settings.dnsType === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-1">Primary DNS</label>
              <input
                id="dns-primary-input"
                type="text"
                value={settings.customDnsPrimary}
                onChange={(e) => onChange({ ...settings, customDnsPrimary: e.target.value })}
                className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-1">Secondary DNS</label>
              <input
                id="dns-secondary-input"
                type="text"
                value={settings.customDnsSecondary}
                onChange={(e) => onChange({ ...settings, customDnsSecondary: e.target.value })}
                className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        )}

        {/* Local Port & MTU */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">SOCKS5 Local Port</label>
            <input
              id="settings-local-port"
              type="number"
              value={settings.localPort}
              onChange={(e) => onChange({ ...settings, localPort: parseInt(e.target.value) || 1080 })}
              className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">MTU Size (Bytes)</label>
            <input
              id="settings-mtu"
              type="number"
              value={settings.mtu}
              onChange={(e) => onChange({ ...settings, mtu: parseInt(e.target.value) || 1500 })}
              className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* UDP Forwarding */}
        <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 md:col-span-2">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-white">Enable UDP GW (Gateway)</p>
              <p className="text-[10px] text-slate-500">Routes UDP packet flows for voice, game clients, and streaming bypass</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              id="toggle-udp-gw"
              type="checkbox"
              checked={settings.enableUdp}
              onChange={(e) => onChange({ ...settings, enableUdp: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
          </label>
        </div>
      </div>

      {/* Hardware Optimization Section */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Hardware Optimization</h4>
        </div>
        <p className="text-[10px] text-slate-500 -mt-2">
          Configure physical chip acceleration registers and low-overhead network driver kernels to optimize VPN stream throughput.
        </p>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* AES-NI Encryption Acceleration Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-white">AES-NI Cryptographic Offloading</span>
              <span className="text-[10px] text-slate-500">Directs hardware cipher block instruction loops on host core</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                id="toggle-aes-ni"
                type="checkbox"
                checked={!!settings.enableAesNi}
                onChange={(e) => onChange({ ...settings, enableAesNi: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>

          {/* Kernel-level Routing Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-white">Kernel-level TUN Routing</span>
              <span className="text-[10px] text-slate-500">Maintains transport stream tables inside privileged kernel space</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                id="toggle-kernel-routing"
                type="checkbox"
                checked={!!settings.enableKernelRouting}
                onChange={(e) => onChange({ ...settings, enableKernelRouting: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>
        </div>
      </div>

      {/* SlowDNS Configurations - dynamically shown only when SlowDNS is active */}
      {selectedProtocol === 'SLOWDNS' && (
        <div className="border-t border-white/10 pt-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">SlowDNS Configuration</h4>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">DNS Tunnel Namespace (NS)</label>
              <input
                id="slowdns-ns"
                type="text"
                value={settings.slowDnsNs}
                onChange={(e) => onChange({ ...settings, slowDnsNs: e.target.value })}
                className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">SlowDNS Public Key (Base64)</label>
              <input
                id="slowdns-key"
                type="text"
                value={settings.slowDnsKey}
                onChange={(e) => onChange({ ...settings, slowDnsKey: e.target.value })}
                className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
