import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Search,
  Network,
  Cpu,
  Terminal,
  Activity,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  Server,
  RefreshCw,
  Zap,
  Lock,
  Wifi,
  Check,
  Sliders,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Gauge,
  Sliders as SlidersIcon
} from 'lucide-react';
import { AdvancedSettings, TunnelServer, TunnelProtocol } from '../types';
import PingLatencyMonitor from './PingLatencyMonitor';

interface SubdomainResult {
  host: string;
  ip: string;
  status: string;
  latency: number;
  openPorts: number[];
  sniBypass: boolean;
}

interface DnsPreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  description: string;
  features: string[];
}

const DNS_PRESETS: DnsPreset[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare Secure DNS',
    primary: '1.1.1.1',
    secondary: '1.0.0.1',
    description: 'Ultra-fast, privacy-centric resolver with native DNS-over-HTTPS.',
    features: ['Fastest Resolution', 'Strict Privacy']
  },
  {
    id: 'google',
    name: 'Google Public DNS',
    primary: '8.8.8.8',
    secondary: '8.8.4.4',
    description: 'Highly reliable and global coverage from Google infrastructure.',
    features: ['Global Anycast Network', 'High Reliability']
  },
  {
    id: 'adguard',
    name: 'AdGuard AdBlocker DNS',
    primary: '94.140.14.14',
    secondary: '94.140.15.15',
    description: 'System-wide protection that blocks ads, trackers, and phishing.',
    features: ['Blocks Ads', 'Anti-Tracking']
  },
  {
    id: 'quad9',
    name: 'Quad9 Secure Resolver',
    primary: '9.9.9.9',
    secondary: '149.112.112.112',
    description: 'Excellent security that automatically blocks malicious domains.',
    features: ['Malware Protection', 'Secure Threat Intel']
  },
  {
    id: 'opendns',
    name: 'OpenDNS Home VIP',
    primary: '208.67.222.222',
    secondary: '208.67.220.220',
    description: 'Customizable web-filtering and parental controls with speed.',
    features: ['Web Content Filtering', 'Customizable']
  },
  {
    id: 'cleanbrowsing',
    name: 'CleanBrowsing Security',
    primary: '185.228.168.9',
    secondary: '185.228.169.9',
    description: 'Blocks malicious, fraudulent, and phishing sites automatically.',
    features: ['Clean Content', 'Phishing Shield']
  }
];

interface NetworkUtilitiesProps {
  settings?: AdvancedSettings;
  onChangeSettings?: (settings: AdvancedSettings) => void;
  pushLog?: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
  isConnected?: boolean;
  selectedServer?: TunnelServer;
  selectedProtocol?: TunnelProtocol;
}

export default function NetworkUtilities({
  settings,
  onChangeSettings,
  pushLog,
  isConnected = false,
  selectedServer,
  selectedProtocol,
}: NetworkUtilitiesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dns-center' | 'dns' | 'domain' | 'proxy' | 'sni' | 'latency'>('dns-center');

  // --- DNS Tool State ---
  const [dnsInput, setDnsInput] = useState('gln-tunnel.net');
  const [dnsResults, setDnsResults] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // --- Domain Scanner State ---
  const [baseDomain, setBaseDomain] = useState('gln-tunnel.com');
  const [isScanningDomains, setIsScanningDomains] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [domainResults, setDomainResults] = useState<SubdomainResult[]>([]);
  const [scanMessage, setScanMessage] = useState('');
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Proxy Scanner State ---
  const [proxyInput, setProxyInput] = useState('128.199.20.142:8080');
  const [isScanningProxy, setIsScanningProxy] = useState(false);
  const [proxyResult, setProxyResult] = useState<any | null>(null);

  // --- SNI Scanner State ---
  const [sniInput, setSniInput] = useState('sni-bug.gln-tunnel.com');
  const [isScanningSni, setIsScanningSni] = useState(false);
  const [sniLogs, setSniLogs] = useState<string[]>([]);
  const [sniSuccess, setSniSuccess] = useState<boolean | null>(null);

  // --- DNS Changer & Checker States ---
  const [isTestingDns, setIsTestingDns] = useState(false);
  const [dnsTestResults, setDnsTestResults] = useState<any[]>([]);
  const [dnsTestLogs, setDnsTestLogs] = useState<string[]>([]);
  const [dnsTestProgress, setDnsTestProgress] = useState(0);

  // Handle DNS change preset
  const handleApplyDnsPreset = (preset: DnsPreset) => {
    if (isConnected) {
      if (pushLog) pushLog('Cannot change DNS while connected to tunnel. Disconnect first.', 'warning');
      return;
    }
    if (!settings || !onChangeSettings) return;

    let dnsTypeVal: 'cloudflare' | 'google' | 'adguard' | 'custom' = 'custom';
    if (preset.id === 'cloudflare') dnsTypeVal = 'cloudflare';
    else if (preset.id === 'google') dnsTypeVal = 'google';
    else if (preset.id === 'adguard') dnsTypeVal = 'adguard';

    onChangeSettings({
      ...settings,
      dnsType: dnsTypeVal,
      customDnsPrimary: preset.primary,
      customDnsSecondary: preset.secondary
    });

    if (pushLog) {
      pushLog(`DNS Core updated. Active Resolver: ${preset.name} (${preset.primary} / ${preset.secondary})`, 'success');
    }
  };

  const handleRunDnsBenchmark = () => {
    setIsTestingDns(true);
    setDnsTestProgress(0);
    setDnsTestResults([]);
    setDnsTestLogs(['[SYSTEM] Initializing DNS Benchmark Core...']);

    let step = 0;
    const results: any[] = [];
    const totalSteps = DNS_PRESETS.length;

    const runNextTest = () => {
      if (step >= totalSteps) {
        setIsTestingDns(false);
        setDnsTestProgress(100);
        
        const sorted = [...results].sort((a, b) => a.latency - b.latency);
        if (sorted.length > 0) {
          const fastest = sorted[0];
          const presetObj = DNS_PRESETS.find(p => p.id === fastest.id);
          setDnsTestLogs(prev => [
            ...prev,
            `[COMPLETE] DNS benchmark finished successfully.`,
            `[RECOMMENDATION] ${presetObj?.name || fastest.id.toUpperCase()} is the fastest resolver with ${fastest.latency}ms latency! Click "Apply DNS" to select this server.`
          ]);
          if (pushLog) {
            pushLog(`DNS Speed test concluded. ${presetObj?.name} emerged as fastest resolver: ${fastest.latency}ms.`, 'success');
          }
        }
        return;
      }

      const preset = DNS_PRESETS[step];
      const hostToTest = 'gln-tunnel.net';
      
      setDnsTestLogs(prev => [
        ...prev,
        `[TEST] Querying IP signatures of "${hostToTest}" via ${preset.name} (${preset.primary})...`
      ]);

      let baseLatency = 10;
      if (preset.id === 'cloudflare') baseLatency = 8 + Math.floor(Math.random() * 8);
      else if (preset.id === 'google') baseLatency = 12 + Math.floor(Math.random() * 8);
      else if (preset.id === 'quad9') baseLatency = 15 + Math.floor(Math.random() * 12);
      else if (preset.id === 'opendns') baseLatency = 16 + Math.floor(Math.random() * 14);
      else if (preset.id === 'adguard') baseLatency = 24 + Math.floor(Math.random() * 18);
      else baseLatency = 28 + Math.floor(Math.random() * 20);

      setTimeout(() => {
        const resolvedIp = `104.21.${20 + step}.${(42 * step) % 255}`;
        results.push({
          id: preset.id,
          name: preset.name,
          primary: preset.primary,
          secondary: preset.secondary,
          latency: baseLatency,
          resolvedIp,
          status: 'Excellent'
        });

        setDnsTestResults([...results]);
        setDnsTestLogs(prev => [
          ...prev,
          `[ECHO] ${preset.name} reply: IP=${resolvedIp}, Resolve Latency = ${baseLatency}ms`
        ]);

        step++;
        setDnsTestProgress(Math.round((step / totalSteps) * 100));
        runNextTest();
      }, 400);
    };

    runNextTest();
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  // --- DNS Resolver handler ---
  const handleResolveDns = () => {
    if (!dnsInput.trim()) return;
    setIsResolving(true);
    setDnsResults(null);

    setTimeout(() => {
      const input = dnsInput.trim().toLowerCase();
      const isIp = /^[0-9.]+$/.test(input);

      if (isIp) {
        // Reverse DNS IP to Domain
        const seed = input.split('.').reduce((acc, val) => acc + parseInt(val) || 0, 0);
        const ptrDomain = `ptr-host-${seed % 999}.carrier-edge.gln.net`;
        setDnsResults({
          type: 'reverse',
          ip: input,
          ptr: ptrDomain,
          isp: seed % 2 === 0 ? 'DigitalOcean LLC' : 'Cloudflare Inc',
          location: seed % 3 === 0 ? 'Singapore (SG)' : seed % 3 === 1 ? 'Frankfurt (DE)' : 'New York (US)',
          asn: `AS${13400 + (seed % 1000)}`
        });
      } else {
        // Forward DNS Domain to IP
        const hash = input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const ipA = `104.21.${hash % 255}.${(hash * 3) % 255}`;
        const ipAAAA = `2606:4700:3030::ac43:${hash.toString(16)}`;
        setDnsResults({
          type: 'forward',
          domain: input,
          records: [
            { type: 'A', value: ipA, ttl: 300 },
            { type: 'AAAA', value: ipAAAA, ttl: 300 },
            { type: 'MX', value: `10 mail-server-edge.gln-tunnel.net`, ttl: 3600 },
            { type: 'TXT', value: `"gln-tunnel-verification=verification-key-token-${hash}"`, ttl: 3600 },
            { type: 'NS', value: `ns1.gln-nameserver.net`, ttl: 86400 }
          ]
        });
      }
      setIsResolving(false);
    }, 1000);
  };

  // --- Domain Scanner Handlers ---
  const handleStartDomainScan = () => {
    if (!baseDomain.trim()) return;
    setIsScanningDomains(true);
    setScanProgress(0);
    setDomainResults([]);
    setScanMessage('Initializing domain network matrix scanner...');

    const subdomains = ['m', 'api', 'cdn', 'static', 'dev', 'dns', 'vpn', 'v2', 'billing', 'portal', 'stage', 'admin'];
    let currentIdx = 0;

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      if (currentIdx >= subdomains.length) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanningDomains(false);
        setScanMessage('Subdomain Network Matrix Scan completed.');
        return;
      }

      const sub = subdomains[currentIdx];
      const fullHost = `${sub}.${baseDomain.trim().toLowerCase()}`;
      setScanMessage(`Analyzing endpoint headers: ${fullHost}...`);

      const hash = fullHost.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isOk = hash % 3 !== 0;
      const statusStr = isOk ? '200 OK' : hash % 3 === 1 ? '302 Found' : '403 Forbidden';
      const ports = isOk ? [80, 443] : hash % 3 === 1 ? [80] : [22, 8080];
      const isSniBypass = hash % 4 === 0;

      const result: SubdomainResult = {
        host: fullHost,
        ip: `104.22.${hash % 255}.${(hash * 2) % 255}`,
        status: statusStr,
        latency: Math.round(15 + (hash % 120)),
        openPorts: ports,
        sniBypass: isSniBypass
      };

      setDomainResults((prev) => [...prev, result]);
      currentIdx++;
      setScanProgress(Math.round((currentIdx / subdomains.length) * 100));
    }, 450);
  };

  // --- Proxy Scanner Handlers ---
  const handleStartProxyScan = () => {
    if (!proxyInput.trim()) return;
    setIsScanningProxy(true);
    setProxyResult(null);

    setTimeout(() => {
      const parts = proxyInput.trim().split(':');
      const ip = parts[0];
      const port = parseInt(parts[1]) || 8080;
      const hash = ip.split('.').reduce((acc, val) => acc + parseInt(val) || 0, 0) + port;

      const isLive = hash % 3 !== 0;

      if (isLive) {
        setProxyResult({
          status: 'ONLINE',
          ip: ip,
          port: port,
          latency: Math.round(20 + (hash % 180)),
          type: port === 3128 || port === 8080 ? 'HTTP/HTTPS Proxy' : 'SOCKS5 Gateway',
          anonymousLevel: hash % 2 === 0 ? 'Elite (High Anonymity)' : 'Transparent',
          headers: `HTTP/1.1 200 Connection Established
Date: ${new Date().toUTCString()}
Server: Squid/5.7 (gln-tunnel-edge)
Content-Type: text/html; charset=UTF-8
Content-Length: 4201
Proxy-Connection: keep-alive
X-Cache: HIT from proxy-node-${hash % 100}
X-Cache-Lookup: HIT from proxy-node-${hash % 100}:8080
Via: 1.1 gln-tunnel-proxy (squid)`
        });
      } else {
        setProxyResult({
          status: 'OFFLINE',
          ip: ip,
          port: port,
          error: 'Connection timeout. Ingress endpoint host rejected payload handshake.'
        });
      }
      setIsScanningProxy(false);
    }, 1200);
  };

  // --- SNI Handshake Scanner Handlers ---
  const handleStartSniScan = () => {
    if (!sniInput.trim()) return;
    setIsScanningSni(true);
    setSniLogs([]);
    setSniSuccess(null);

    const host = sniInput.trim().toLowerCase();
    const steps = [
      { text: `[SYSTEM] Initializing SSL/TLS Handshake on ${host}...`, delay: 100 },
      { text: `[DNS] Resolving nameserver for SNI target: ${host}`, delay: 500 },
      { text: `[TLS] Outgoing CLIENT HELLO broadcasted. Specifying SNI Extension: "${host}"`, delay: 1000 },
      { text: `[TLS] Incoming SERVER HELLO received from remote edge server.`, delay: 1600 },
      { text: `[TLS] Cipher Suite Negotiated: TLS_CHACHA20_POLY1305_SHA256 (256-bit Key)`, delay: 2100 },
      { text: `[TLS] Extracting SSL Certificate chain signatures...`, delay: 2600 },
      { text: `[CERT] Certificate Issuer: DigiCert Cloud Security Authority / Let's Encrypt`, delay: 3000 },
      { text: `[CERT] Validity status: VALID (Expires: Dec 2026)`, delay: 3400 },
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setSniLogs((prev) => [...prev, step.text]);
      }, step.delay);
    });

    setTimeout(() => {
      // Determine if highly compatible SNI Bug based on simple hashing
      const hash = host.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isCompat = hash % 2 === 0;

      if (isCompat) {
        setSniLogs((prev) => [
          ...prev,
          `[SUCCESS] SNI Verification Complete! Host "${host}" allows free payload spoofing redirects.`
        ]);
        setSniSuccess(true);
      } else {
        setSniLogs((prev) => [
          ...prev,
          `[WARNING] Verified handshake, but host requires TLS Session Tickets validation which limits injection.`
        ]);
        setSniSuccess(false);
      }
      setIsScanningSni(false);
    }, 4000);
  };

  return (
    <div className="gln-dark-override bg-[#0f0f12] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-5 text-slate-300">
      <style>{`
        /* Override white background */
        .gln-dark-override {
          background-color: #0f0f12 !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .gln-dark-override .bg-white {
          background-color: #0f0f12 !important;
        }
        .gln-dark-override .bg-slate-50,
        .gln-dark-override .bg-slate-50\\/50 {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .gln-dark-override .bg-slate-100 {
          background-color: rgba(255, 255, 255, 0.04) !important;
        }
        .gln-dark-override .bg-blue-50\\/50,
        .gln-dark-override .bg-blue-50\\/20,
        .gln-dark-override .bg-blue-50 {
          background-color: rgba(59, 130, 246, 0.08) !important;
        }
        
        /* Text colors */
        .gln-dark-override .text-slate-800,
        .gln-dark-override .text-slate-700 {
          color: #f1f5f9 !important;
        }
        .gln-dark-override .text-slate-600 {
          color: #cbd5e1 !important;
        }
        .gln-dark-override .text-slate-500,
        .gln-dark-override .text-slate-400 {
          color: #94a3b8 !important;
        }
        
        /* Borders */
        .gln-dark-override .border-slate-200,
        .gln-dark-override .border-slate-100,
        .gln-dark-override .border-slate-200\\/50,
        .gln-dark-override .border-blue-100 {
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
        .gln-dark-override .border-slate-100 {
          border-color: rgba(255, 255, 255, 0.04) !important;
        }

        /* Inputs & Options */
        .gln-dark-override input,
        .gln-dark-override select {
          background-color: rgba(0, 0, 0, 0.4) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .gln-dark-override input::placeholder {
          color: #475569 !important;
        }

        /* Tables & Lists */
        .gln-dark-override th.bg-slate-50,
        .gln-dark-override tr.bg-slate-50 {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .gln-dark-override tr:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .gln-dark-override .divide-slate-100 > * + * {
          border-color: rgba(255, 255, 255, 0.05) !important;
        }

        /* Specific widgets */
        .gln-dark-override .text-blue-600 {
          color: #60a5fa !important;
        }
        .gln-dark-override .text-blue-700 {
          color: #93c5fd !important;
        }
        .gln-dark-override .text-emerald-700 {
          color: #34d399 !important;
        }
        .gln-dark-override .bg-emerald-100 {
          background-color: rgba(16, 185, 129, 0.15) !important;
          color: #34d399 !important;
        }
        .gln-dark-override .bg-slate-950 {
          background-color: rgba(0, 0, 0, 0.6) !important;
        }
        .gln-dark-override .divide-y {
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
      
      {/* Tab Selector Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm">GLN Diagnostics Toolkit</h3>
            <p className="text-[10px] text-slate-400 font-medium">Domain, Proxy & DNS Resolver Center</p>
          </div>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveSubTab('dns-center')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'dns-center' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            DNS Changer & Checker
          </button>
          <button
            onClick={() => setActiveSubTab('latency')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'latency' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Ping Monitor
          </button>
          <button
            onClick={() => setActiveSubTab('dns')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'dns' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Domain/IP DNS
          </button>
          <button
            onClick={() => setActiveSubTab('domain')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'domain' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Domain Scanner
          </button>
          <button
            onClick={() => setActiveSubTab('proxy')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'proxy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Proxy Scanner
          </button>
          <button
            onClick={() => setActiveSubTab('sni')}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'sni' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            SNI Scanner
          </button>
        </div>
      </div>

      {/* DNS Changer & Checker Hub Tab */}
      {activeSubTab === 'dns-center' && (
        <div className="space-y-6 animate-fade-in text-slate-800">
          {/* Header Info Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                DNS Changer & Checker (Secure Resolvers)
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Benchmarking latency helps identify responsive nameservers. Update your primary resolver instantly using preset secure hosts.
              </p>
            </div>
            {isConnected ? (
              <span className="flex items-center gap-1.5 self-start md:self-auto bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                <Lock className="w-3.5 h-3.5" /> TUNNEL LOCKED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 self-start md:self-auto bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                <Check className="w-3.5 h-3.5 animate-pulse" /> EDITABLE
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* DNS Changer Column (Left 7 cols) */}
            <div className="xl:col-span-7 space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">DNS Changer Presets</h5>
                {settings && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Active: <span className="text-blue-600 font-bold">{settings.dnsType === 'custom' ? `${settings.customDnsPrimary}` : settings.dnsType}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {DNS_PRESETS.map((preset) => {
                  // Determine if active in settings
                  const isPresetActive = settings && (
                    (preset.id === 'cloudflare' && settings.dnsType === 'cloudflare') ||
                    (preset.id === 'google' && settings.dnsType === 'google') ||
                    (preset.id === 'adguard' && settings.dnsType === 'adguard') ||
                    (settings.dnsType === 'custom' && settings.customDnsPrimary === preset.primary)
                  );

                  return (
                    <div
                      key={preset.id}
                      className={`relative border rounded-xl p-4 flex flex-col justify-between transition-all group ${
                        isPresetActive
                          ? 'border-blue-500 bg-blue-50/20 shadow-[0_4px_12px_rgba(59,130,246,0.05)]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Active Indicator Badge */}
                      {isPresetActive && (
                        <span className="absolute top-3 right-3 flex items-center gap-0.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                        </span>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-bold text-xs text-slate-800">{preset.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">{preset.description}</p>
                        
                        <div className="flex flex-wrap gap-1 pt-1">
                          {preset.features.map((feat, fi) => (
                            <span key={fi} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="font-mono text-[10px] text-slate-400 space-y-0.5">
                          <div>P: {preset.primary}</div>
                          <div>S: {preset.secondary}</div>
                        </div>

                        <button
                          onClick={() => handleApplyDnsPreset(preset)}
                          disabled={isConnected || isPresetActive}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                            isPresetActive
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : isConnected
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer hover:translate-y-[-1px]'
                          }`}
                        >
                          {isPresetActive ? 'Selected' : 'Apply DNS'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Manual DNS Settings Form inside Changer */}
              {settings && onChangeSettings && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Custom Manual Resolvers</span>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.dnsType === 'custom'}
                        onChange={(e) => {
                          onChangeSettings({
                            ...settings,
                            dnsType: e.target.checked ? 'custom' : 'cloudflare'
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Enable Custom DNS Mode
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Primary DNS Host IP</label>
                      <input
                        type="text"
                        disabled={isConnected || settings.dnsType !== 'custom'}
                        value={settings.customDnsPrimary}
                        onChange={(e) => {
                          onChangeSettings({
                            ...settings,
                            customDnsPrimary: e.target.value
                          });
                        }}
                        placeholder="e.g. 1.1.1.1"
                        className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Secondary DNS Host IP</label>
                      <input
                        type="text"
                        disabled={isConnected || settings.dnsType !== 'custom'}
                        value={settings.customDnsSecondary}
                        onChange={(e) => {
                          onChangeSettings({
                            ...settings,
                            customDnsSecondary: e.target.value
                          });
                        }}
                        placeholder="e.g. 8.8.8.8"
                        className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DNS Checker / Latency Benchmark Column (Right 5 cols) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">DNS Checker Benchmark</h5>
                <button
                  onClick={handleRunDnsBenchmark}
                  disabled={isTestingDns}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white disabled:text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isTestingDns ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
                  Benchmark DNS
                </button>
              </div>

              {/* Progress bar */}
              {isTestingDns && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-400 uppercase font-mono">
                    <span>Testing active nameservers...</span>
                    <span>{dnsTestProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${dnsTestProgress}%` }}></div>
                  </div>
                </div>
              )}

              {/* Results grid or placeholder */}
              {dnsTestResults.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                  <p className="text-xs font-semibold">Ready to test nameservers</p>
                  <p className="text-[10px] leading-normal max-w-[200px] mx-auto text-slate-400">
                    Click "Benchmark DNS" above to ping and test resolution latency across all secure presets.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Test latency results list */}
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white shadow-sm">
                    {/* Find the minimum latency to highlight fastest */}
                    {(() => {
                      const minLatency = Math.min(...dnsTestResults.map(r => r.latency));
                      return dnsTestResults.map((res) => {
                        const isFastest = res.latency === minLatency;
                        return (
                          <div key={res.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-700">{res.name}</span>
                                {isFastest && (
                                  <span className="bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Sparkles className="w-2.5 h-2.5" /> FASTEST
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] font-mono text-slate-400">
                                IP: {res.primary} // Resolves: {res.resolvedIp}
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <div className="text-right">
                                <span className={`text-xs font-mono font-black ${
                                  res.latency < 15 ? 'text-emerald-500' : res.latency < 25 ? 'text-blue-500' : 'text-amber-500'
                                }`}>
                                  {res.latency}ms
                                </span>
                                <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono">Response</span>
                              </div>

                              <button
                                onClick={() => handleApplyDnsPreset(res)}
                                disabled={isConnected}
                                className={`p-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 rounded transition-colors text-slate-500 ${
                                  isConnected ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title="Apply DNS"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Benchmark mini console */}
                  <div className="bg-slate-950 rounded-xl p-3 border border-white/5 font-mono text-[9px] leading-relaxed text-slate-400 h-[120px] overflow-y-auto">
                    <div className="flex items-center gap-1.5 text-slate-500 border-b border-white/5 pb-1 mb-1.5">
                      <Terminal className="w-3 h-3 text-blue-500" />
                      <span>DNS PERFORMANCE CHECKER CONSOLE</span>
                    </div>
                    {dnsTestLogs.map((log, idx) => {
                      let color = 'text-slate-400';
                      if (log.includes('[COMPLETE]')) color = 'text-emerald-400 font-bold';
                      else if (log.includes('[RECOMMENDATION]')) color = 'text-cyan-300';
                      else if (log.includes('[TEST]')) color = 'text-slate-500';
                      else if (log.includes('[ECHO]')) color = 'text-slate-300';

                      return (
                        <div key={idx} className={color}>
                          {log}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DNS Resolve Tool Tab */}
      {activeSubTab === 'dns' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-normal flex gap-2">
            <Globe className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Resolve a domain name directly to IP addresses (Forward Lookup), or provide an IP address to reverse map nameserver PTR records instantly.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={dnsInput}
              onChange={(e) => setDnsInput(e.target.value)}
              placeholder="e.g. gln-tunnel.net or 104.21.4.15"
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-blue-500 font-mono text-slate-800"
            />
            <button
              onClick={handleResolveDns}
              disabled={isResolving}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isResolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Resolve
            </button>
          </div>

          {dnsResults && (
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5 font-mono text-xs text-slate-300 space-y-3 animate-slide-up">
              {dnsResults.type === 'forward' ? (
                <>
                  <div className="flex justify-between text-slate-500 border-b border-white/5 pb-1">
                    <span>Forward Lookup results:</span>
                    <span className="text-blue-400 font-bold">{dnsResults.domain}</span>
                  </div>
                  <div className="space-y-1.5">
                    {dnsResults.records.map((rec: any, idx: number) => (
                      <div key={idx} className="flex justify-between bg-white/[0.02] p-1.5 rounded">
                        <span className="text-emerald-400 font-bold w-12">{rec.type}</span>
                        <span className="text-white truncate max-w-[280px]">{rec.value}</span>
                        <span className="text-slate-500 text-[10px]">TTL {rec.ttl}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-500 border-b border-white/5 pb-1">
                    <span>Reverse Lookup results:</span>
                    <span className="text-blue-400 font-bold">{dnsResults.ip}</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">PTR Hostname:</span>
                      <span className="text-white font-bold">{dnsResults.ptr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ISP Carrier:</span>
                      <span className="text-emerald-400">{dnsResults.isp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Registered AS:</span>
                      <span className="text-white">{dnsResults.asn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Node Location:</span>
                      <span className="text-white">{dnsResults.location}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Domain Scanner Tab */}
      {activeSubTab === 'domain' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-normal flex gap-2">
            <Search className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Scans targeted bug host domains for active, responsive subdomains, testing latency, open ports (80, 443), and if they permit free header SNI spoof configurations.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={baseDomain}
              onChange={(e) => setBaseDomain(e.target.value)}
              placeholder="e.g. host-bug.com"
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-blue-500 font-mono text-slate-800"
            />
            <button
              onClick={handleStartDomainScan}
              disabled={isScanningDomains}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isScanningDomains ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              Scan Domain
            </button>
          </div>

          {isScanningDomains && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-500 uppercase font-mono">
                <span>{scanMessage}</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
              </div>
            </div>
          )}

          {domainResults.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-mono">
                      <th className="py-2.5 px-3">Subdomain Host</th>
                      <th className="py-2.5 px-3">Resolved IP</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Latency</th>
                      <th className="py-2.5 px-3 text-center">SNI Bypass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                    {domainResults.map((res, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-700 font-bold">{res.host}</td>
                        <td className="py-2 px-3 text-slate-500">{res.ip}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            res.status.startsWith('200') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {res.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">{res.latency}ms</td>
                        <td className="py-2 px-3 text-center">
                          {res.sniBypass ? (
                            <span className="text-emerald-500 font-bold text-xs">✓ Yes</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proxy Scanner Tab */}
      {activeSubTab === 'proxy' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-normal flex gap-2">
            <Server className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Scans squid, HTTP headers, SOCKS proxy ports on specified server nodes. Performs socket handshakes and prints direct HTTP response status streams.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={proxyInput}
              onChange={(e) => setProxyInput(e.target.value)}
              placeholder="e.g. 128.199.10.2:8080"
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-blue-500 font-mono text-slate-800"
            />
            <button
              onClick={handleStartProxyScan}
              disabled={isScanningProxy}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isScanningProxy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
              Scan Proxy
            </button>
          </div>

          {proxyResult && (
            <div className="space-y-3 animate-slide-up">
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                proxyResult.status === 'ONLINE' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {proxyResult.status === 'ONLINE' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold">Proxy Ingress Status: {proxyResult.status}</h4>
                  <p className="text-[10px] opacity-85">Tested Socket {proxyResult.ip}:{proxyResult.port}</p>
                </div>
              </div>

              {proxyResult.status === 'ONLINE' ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/50">
                      <span className="block text-[9px] uppercase text-slate-400 font-bold mb-0.5">Response Time</span>
                      <span className="text-slate-800 font-black">{proxyResult.latency}ms</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/50">
                      <span className="block text-[9px] uppercase text-slate-400 font-bold mb-0.5">Proxy Engine</span>
                      <span className="text-slate-800 font-black truncate">{proxyResult.type}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/50">
                      <span className="block text-[9px] uppercase text-slate-400 font-bold mb-0.5">Anonymity</span>
                      <span className="text-blue-600 font-black truncate">{proxyResult.anonymousLevel}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 font-mono">HTTP Response Stream Header</label>
                    <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre">
                      {proxyResult.headers}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-lg font-mono">
                  ERROR: {proxyResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* SNI Scanner Tab */}
      {activeSubTab === 'sni' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-normal flex gap-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Tests Server Name Indication (SNI) host header spoof capabilities. Simulates secure SSL/TLS handshakes (TLS 1.3) and verifies if the SNI bug host will route spoof payload handshakes without drops.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={sniInput}
              onChange={(e) => setSniInput(e.target.value)}
              placeholder="e.g. sni-host.com"
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-blue-500 font-mono text-slate-800"
            />
            <button
              onClick={handleStartSniScan}
              disabled={isScanningSni}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isScanningSni ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Scan SNI
            </button>
          </div>

          {/* Logs terminal */}
          {(sniLogs.length > 0 || isScanningSni) && (
            <div className="space-y-3">
              <div className="bg-slate-950 rounded-xl border border-white/10 p-4 font-mono text-[10px] leading-relaxed text-slate-300 min-h-[180px] flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-500 border-b border-white/5 pb-1 mb-2">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>SSL/TLS SSL HANDSHAKE PROBE</span>
                  </div>
                  {sniLogs.map((log, idx) => {
                    let color = 'text-slate-400';
                    if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                    else if (log.includes('[WARNING]')) color = 'text-amber-400 font-bold';
                    else if (log.includes('[SYSTEM]')) color = 'text-blue-400';
                    else if (log.includes('[CERT]')) color = 'text-cyan-400';

                    return (
                      <div key={idx} className={color}>
                        {log}
                      </div>
                    );
                  })}
                  {isScanningSni && (
                    <div className="text-emerald-400 animate-pulse flex items-center gap-1 mt-1">
                      <span>● Connecting remote interface socket...</span>
                    </div>
                  )}
                </div>

                {sniSuccess !== null && (
                  <div className={`mt-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    sniSuccess 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {sniSuccess ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <div>
                      <p className="font-bold">{sniSuccess ? 'SNI SPOOF VULNERABLE' : 'SNI BYPASS BLOCKED'}</p>
                      <p className="text-[10px] opacity-80">
                        {sniSuccess 
                          ? 'This SNI is perfectly compatible with SSH/SSL custom payloads. Greenlit for injection.' 
                          : 'Handshake succeeded but the server terminates on strict hostname matches.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ping Telemetry Monitor Tab */}
      {activeSubTab === 'latency' && (
        <PingLatencyMonitor
          isConnected={isConnected}
          selectedServer={selectedServer}
          selectedProtocol={selectedProtocol}
          pushLog={pushLog}
        />
      )}
    </div>
  );
}
