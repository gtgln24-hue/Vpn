import { useState } from 'react';
import { PayloadConfig } from '../types';
import { Settings, RefreshCw, Zap, Copy, Check, FileCode, Lock } from 'lucide-react';

interface PayloadGeneratorProps {
  config: PayloadConfig;
  onChange: (newConfig: PayloadConfig) => void;
  isLocked?: boolean;
}

const PRESETS = [
  {
    name: 'Standard Keep-Alive',
    method: 'CONNECT' as const,
    bugHost: 'm.twitter.com',
    split: 'none' as const,
    extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: false, forwardHost: false },
  },
  {
    name: 'Cloudflare SNI Bypass',
    method: 'GET' as const,
    bugHost: 'cdn.netflix.com',
    split: 'instant_split' as const,
    extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: true, forwardHost: true },
  },
  {
    name: 'HTTP Custom Payload',
    method: 'POST' as const,
    bugHost: 'line.me',
    split: 'delay_split' as const,
    extraHeaders: { keepAlive: true, onlineHost: false, userAgent: true, referer: false, forwardHost: false },
  },
];

export default function PayloadGenerator({ config, onChange, isLocked = false }: PayloadGeneratorProps) {
  const [method, setMethod] = useState<PayloadConfig['method']>(config.method);
  const [bugHost, setBugHost] = useState(config.bugHost);
  const [split, setSplit] = useState<PayloadConfig['split']>(config.split);
  const [extraHeaders, setExtraHeaders] = useState(config.extraHeaders);
  const [copied, setCopied] = useState(false);

  const generatePayloadString = (
    m: PayloadConfig['method'],
    host: string,
    spl: PayloadConfig['split'],
    headers: typeof extraHeaders
  ): string => {
    let result = '';
    const cleanHost = host.trim() || 'bug.com';

    if (m === 'CONNECT') {
      result += `CONNECT [host_port] [protocol]`;
    } else {
      result += `${m} http://${cleanHost}/ HTTP/1.1`;
    }

    if (spl === 'instant_split') {
      result += `[instant_split]`;
    } else if (spl === 'delay_split') {
      result += `[delay_split]`;
    }

    result += `[crlf]Host: ${cleanHost}[crlf]`;

    if (headers.keepAlive) result += `Connection: keep-alive[crlf]`;
    if (headers.onlineHost) result += `X-Online-Host: ${cleanHost}[crlf]`;
    if (headers.userAgent) result += `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36[crlf]`;
    if (headers.referer) result += `Referer: https://${cleanHost}/[crlf]`;
    if (headers.forwardHost) result += `X-Forward-Host: ${cleanHost}[crlf]`;

    result += `[crlf]`;
    return result;
  };

  const handleGenerate = () => {
    const payloadStr = generatePayloadString(method, bugHost, split, extraHeaders);
    onChange({
      method,
      bugHost,
      split,
      extraHeaders,
      customPayload: payloadStr,
    });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setMethod(preset.method);
    setBugHost(preset.bugHost);
    setSplit(preset.split);
    setExtraHeaders(preset.extraHeaders);

    const payloadStr = generatePayloadString(preset.method, preset.bugHost, preset.split, preset.extraHeaders);
    onChange({
      method: preset.method,
      bugHost: preset.bugHost,
      split: preset.split,
      extraHeaders: preset.extraHeaders,
      customPayload: payloadStr,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(config.customPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Header banner */}
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-white text-sm">Payload Injection Engine</h3>
            <p className="text-[10px] text-slate-500">Inject dynamic host headers and injection split commands</p>
          </div>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/10">
          HTTP / TLS SNI
        </span>
      </div>

      {/* Lock banner if frozen */}
      {isLocked && (
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/25 text-amber-300 rounded-xl p-4 mb-5 animate-slide-up">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold text-white block mb-0.5">Configuration frozen by profile lock</span>
            <p className="text-slate-400 font-sans">All injection rules and hosts are locked in read-only mode by the profile publisher. If you wish to make changes, please clear/reset the .gln configuration.</p>
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="mb-5">
        <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Payload Presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              id={`preset-btn-${idx}`}
              disabled={isLocked}
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 disabled:cursor-not-allowed text-slate-300 font-semibold px-3 py-2 rounded-xl border border-white/5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Request Method</label>
          <select
            id="payload-method-select"
            disabled={isLocked}
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="w-full text-xs bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="CONNECT">CONNECT (Proxy Default)</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Bug Host / SNI Spoof</label>
          <input
            id="payload-bug-host-input"
            type="text"
            disabled={isLocked}
            value={bugHost}
            onChange={(e) => setBugHost(e.target.value)}
            placeholder="e.g. m.twitter.com"
            className="w-full text-xs bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Payload Splitting Mode</label>
          <select
            id="payload-split-select"
            disabled={isLocked}
            value={split}
            onChange={(e) => setSplit(e.target.value as any)}
            className="w-full text-xs bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="none">None (Standard Header)</option>
            <option value="instant_split">Instant Split [instant_split]</option>
            <option value="delay_split">Delay Split [delay_split]</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Extra Header Injections</label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 bg-slate-950 border border-white/5 rounded-xl p-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                id="header-keep-alive"
                type="checkbox"
                disabled={isLocked}
                checked={extraHeaders.keepAlive}
                onChange={(e) => setExtraHeaders({ ...extraHeaders, keepAlive: e.target.checked })}
                className="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={isLocked ? 'text-slate-500' : ''}>Keep-Alive</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                id="header-online-host"
                type="checkbox"
                disabled={isLocked}
                checked={extraHeaders.onlineHost}
                onChange={(e) => setExtraHeaders({ ...extraHeaders, onlineHost: e.target.checked })}
                className="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={isLocked ? 'text-slate-500' : ''}>Online Host</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                id="header-user-agent"
                type="checkbox"
                disabled={isLocked}
                checked={extraHeaders.userAgent}
                onChange={(e) => setExtraHeaders({ ...extraHeaders, userAgent: e.target.checked })}
                className="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={isLocked ? 'text-slate-500' : ''}>User-Agent</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                id="header-referer"
                type="checkbox"
                disabled={isLocked}
                checked={extraHeaders.referer}
                onChange={(e) => setExtraHeaders({ ...extraHeaders, referer: e.target.checked })}
                className="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={isLocked ? 'text-slate-500' : ''}>Referer</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          id="btn-generate-payload"
          disabled={isLocked}
          onClick={handleGenerate}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-white/5 border border-transparent disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-hover:spin" />
          <span>Compile Payload Injection Rules</span>
        </button>
      </div>

      <div className="relative">
        <div className="flex justify-between items-center bg-slate-950 px-3.5 py-2.5 rounded-t-xl border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 font-bold">Active Injection String</span>
          </div>
          <button
            id="btn-copy-payload"
            onClick={copyToClipboard}
            className="text-slate-400 hover:text-white transition-colors"
            title="Copy payload"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <textarea
          id="payload-output-textarea"
          disabled={isLocked}
          value={config.customPayload}
          onChange={(e) => onChange({ ...config, customPayload: e.target.value })}
          rows={3}
          className="w-full font-mono text-[11px] bg-slate-950 text-emerald-400 p-4 rounded-b-xl border-x border-b border-white/5 focus:outline-none resize-none leading-relaxed disabled:opacity-75 disabled:cursor-not-allowed"
          placeholder="No custom payload loaded. Click Generate or select a Preset."
        />
      </div>
    </div>
  );
}
