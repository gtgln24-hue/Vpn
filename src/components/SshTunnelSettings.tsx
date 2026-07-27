import { useState } from 'react';
import { AdvancedSettings } from '../types';
import { Check, ShieldCheck, Sliders, HelpCircle, Save } from 'lucide-react';

interface SshTunnelSettingsProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
  isConnected: boolean;
  pushLog: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

type ConnectFromType = 'direct' | 'dns' | 'http_proxy' | 'http_obfs' | 'tls_proxy' | 'tls_obfs' | 'tls_stunnel';

export default function SshTunnelSettings({
  settings,
  onChange,
  isConnected,
  pushLog,
}: SshTunnelSettingsProps) {
  // Local state for form fields
  const [connectFrom, setConnectFrom] = useState<ConnectFromType>(
    settings.sshConnectFrom || 'http_proxy'
  );
  const [customPayload, setCustomPayload] = useState<boolean>(
    settings.sshCustomPayload || false
  );
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const handleConnectFromChange = (value: ConnectFromType) => {
    setConnectFrom(value);
    setHasChanges(true);
  };

  const handleCustomPayloadChange = (checked: boolean) => {
    setCustomPayload(checked);
    setHasChanges(true);
  };

  const handleSave = () => {
    onChange({
      ...settings,
      sshConnectFrom: connectFrom,
      sshCustomPayload: customPayload,
    });
    setHasChanges(false);
    
    // Log friendly text
    const displayNames: Record<ConnectFromType, string> = {
      direct: 'None (Direct)',
      dns: 'DNS (DNSTT)',
      http_proxy: 'HTTP Proxy',
      http_obfs: 'HTTP (Obfs)',
      tls_proxy: 'TLS/SSL Proxy',
      tls_obfs: 'TLS/SSL (Obfs)',
      tls_stunnel: 'TLS/SSL (stunnel)',
    };
    
    pushLog(
      `SSH configuration saved: connect via [${displayNames[connectFrom]}] ${
        customPayload ? 'with Custom Payload' : 'without payload injections'
      }.`,
      'success'
    );
  };

  // Helper to determine Selected Tunnel Type text
  const getSelectedTunnelTypeText = () => {
    const map: Record<ConnectFromType, string> = {
      direct: 'None Direct ➔ SSH',
      dns: 'DNS (DNSTT) ➔ SSH',
      http_proxy: 'HTTP Proxy ➔ SSH',
      http_obfs: 'HTTP (Obfs) ➔ SSH',
      tls_proxy: 'TLS/SSL Proxy ➔ SSH',
      tls_obfs: 'TLS/SSL (Obfs) ➔ SSH',
      tls_stunnel: 'TLS/SSL (stunnel) ➔ SSH',
    };
    return map[connectFrom];
  };

  // Helper to determine Badge text
  const getBadgeText = () => {
    const map: Record<ConnectFromType, string> = {
      direct: 'TCP (DIRECT)',
      dns: 'UDP (DNSTT)',
      http_proxy: 'TCP (HTTP)',
      http_obfs: 'TCP (OBFS)',
      tls_proxy: 'TLS (SSL)',
      tls_obfs: 'TLS (OBFS)',
      tls_stunnel: 'TLS (STUNNEL)',
    };
    return map[connectFrom];
  };

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* 1. Header Display Card: Selected Tunnel Type */}
      <div className="bg-[#112d37] border border-teal-500/20 rounded-xl p-5 shadow-[0_4px_25px_rgba(13,148,136,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none"></div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
          Selected Tunnel Type
        </span>
        <div className="flex items-center justify-between mt-1">
          <h2 className="text-lg font-bold text-white tracking-wide font-sans">
            {getSelectedTunnelTypeText()}
          </h2>
          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black px-2.5 py-1 rounded font-mono uppercase tracking-wider">
            {getBadgeText()}
          </span>
        </div>
      </div>

      {/* Main Form container matching the clean aesthetic */}
      <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-5 space-y-5 shadow-2xl relative">
        {isConnected && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center z-10 p-4 text-center">
            <Sliders className="w-8 h-8 text-amber-500 animate-pulse mb-2" />
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              Configuration Locked
            </p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">
              Disconnect from the gateway first to modify Tunnel Settings or change transport modes.
            </p>
          </div>
        )}

        {/* 2. Tunnel Type */}
        <div className="space-y-3">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
            Tunnel Type
          </label>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <input
                  id="tunnel-type-ssh"
                  type="radio"
                  name="tunnel_type"
                  checked={true}
                  readOnly
                  className="sr-only"
                />
                <div className="w-4 h-4 rounded-full border border-teal-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-teal-400"></div>
                </div>
              </div>
              <span className="text-xs font-semibold text-white">
                Secure Shell (SSH)
              </span>
            </div>
            <ShieldCheck className="w-4 h-4 text-teal-500" />
          </div>
        </div>

        {/* 3. Connect From Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              Connect From
            </label>
            <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" title="Select the routing transport layer" />
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* None (Direct) */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="direct"
                      checked={connectFrom === 'direct'}
                      onChange={() => handleConnectFromChange('direct')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'direct' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'direct' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'direct' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    None (Direct)
                  </span>
                </label>

                {/* HTTP Proxy */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="http_proxy"
                      checked={connectFrom === 'http_proxy'}
                      onChange={() => handleConnectFromChange('http_proxy')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'http_proxy' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'http_proxy' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'http_proxy' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    HTTP Proxy
                  </span>
                </label>

                {/* TLS/SSL Proxy */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="tls_proxy"
                      checked={connectFrom === 'tls_proxy'}
                      onChange={() => handleConnectFromChange('tls_proxy')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'tls_proxy' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'tls_proxy' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'tls_proxy' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    TLS/SSL Proxy
                  </span>
                </label>

                {/* TLS/SSL (stunnel) */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="tls_stunnel"
                      checked={connectFrom === 'tls_stunnel'}
                      onChange={() => handleConnectFromChange('tls_stunnel')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'tls_stunnel' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'tls_stunnel' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'tls_stunnel' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    TLS/SSL (stunnel)
                  </span>
                </label>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* DNS (DNSTT) */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="dns"
                      checked={connectFrom === 'dns'}
                      onChange={() => handleConnectFromChange('dns')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'dns' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'dns' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'dns' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    DNS (DNSTT)
                  </span>
                </label>

                {/* HTTP (Obfs) */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="http_obfs"
                      checked={connectFrom === 'http_obfs'}
                      onChange={() => handleConnectFromChange('http_obfs')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'http_obfs' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'http_obfs' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'http_obfs' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    HTTP (Obfs)
                  </span>
                </label>

                {/* TLS/SSL (Obfs) */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="radio"
                      name="connect_from"
                      value="tls_obfs"
                      checked={connectFrom === 'tls_obfs'}
                      onChange={() => handleConnectFromChange('tls_obfs')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                      connectFrom === 'tls_obfs' ? 'border-teal-500' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {connectFrom === 'tls_obfs' && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                    </div>
                  </div>
                  <span className={`text-xs transition-colors ${
                    connectFrom === 'tls_obfs' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    TLS/SSL (Obfs)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Options */}
        <div className="space-y-3">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
            Options
          </label>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <input
                id="checkbox-custom-payload"
                type="checkbox"
                checked={customPayload}
                onChange={(e) => handleCustomPayloadChange(e.target.checked)}
                className="rounded border-white/20 text-teal-500 focus:ring-teal-500 bg-black/40 focus:ring-offset-black"
              />
              <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                Custom Payload
              </span>
            </label>
          </div>
        </div>

        {/* 5. Save Button */}
        <button
          id="btn-ssh-settings-save"
          onClick={handleSave}
          className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all duration-300 flex items-center justify-center gap-2 ${
            hasChanges
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 hover:from-teal-400 hover:to-cyan-400 shadow-[0_4px_25px_rgba(20,184,166,0.3)]'
              : 'bg-white/10 text-slate-400 hover:bg-white/15 hover:text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          Save Configurations
        </button>
      </div>

      {/* Key locker hint banner */}
      <div className="bg-[#0f0f12] border border-white/5 rounded-2xl p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white">Automating Authentication?</h4>
          <p className="text-[10px] text-slate-400 leading-normal">
            To use public key authentication instead of passwords, head over to the <strong>SSH Key Locker</strong> tab, register your local private keys, and bind them to your custom server nodes.
          </p>
        </div>
      </div>
    </div>
  );
}
