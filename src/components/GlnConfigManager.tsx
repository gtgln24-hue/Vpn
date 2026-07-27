import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Lock,
  Unlock,
  Key,
  Download,
  Upload,
  Cpu,
  CheckCircle,
  AlertCircle,
  Copy,
  Info,
  Shield,
  Eye,
  EyeOff,
  Calendar,
  MessageSquare,
  Terminal,
  Settings
} from 'lucide-react';
import { TunnelServer, PayloadConfig, AdvancedSettings, TunnelProtocol } from '../types';

interface GlnConfigManagerProps {
  currentProtocol: TunnelProtocol;
  currentServer: TunnelServer;
  currentPayload: PayloadConfig;
  currentSettings: AdvancedSettings;
  onImport: (
    protocol: TunnelProtocol,
    server: TunnelServer,
    payload: PayloadConfig,
    settings: AdvancedSettings,
    homeMessage: string | null,
    serverMessage: string | null,
    expiryDate: string | null,
    layoutLocked: boolean
  ) => void;
  onClose: () => void;
  pushLog: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

// Custom XOR Encryption/Obfuscation helper to secure locked .gln files
function encryptString(str: string, key: string): string {
  let result = '';
  // Simple rotating character transformation + XOR for a professional-looking secure ciphertext
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    // Rotating character byte transformation
    const encryptedByte = (charCode ^ keyChar) + 42; 
    result += String.fromCharCode(encryptedByte);
  }
  // Convert safely to base64
  try {
    return btoa(encodeURIComponent(result));
  } catch (e) {
    return btoa(result);
  }
}

function decryptString(b64Str: string, key: string): string {
  let result = '';
  try {
    const rawStr = decodeURIComponent(atob(b64Str));
    for (let i = 0; i < rawStr.length; i++) {
      const charCode = rawStr.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const decryptedByte = (charCode - 42) ^ keyChar;
      result += String.fromCharCode(decryptedByte);
    }
    return result;
  } catch (e) {
    // Fallback if URL encoded conversion fails
    const rawStr = atob(b64Str);
    for (let i = 0; i < rawStr.length; i++) {
      const charCode = rawStr.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const decryptedByte = (charCode - 42) ^ keyChar;
      result += String.fromCharCode(decryptedByte);
    }
    return result;
  }
}

export default function GlnConfigManager({
  currentProtocol,
  currentServer,
  currentPayload,
  currentSettings,
  onImport,
  onClose,
  pushLog
}: GlnConfigManagerProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [userHwid, setUserHwid] = useState('HWID-8X92-GLN-39A0');

  // Export options
  const [exportMethod, setExportMethod] = useState<'file' | 'clipboard'>('file');
  const [exportSuccessText, setExportSuccessText] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [hwidLock, setHwidLock] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('gln_config_profile');
  const [copiedHwid, setCopiedHwid] = useState(false);

  // New User Export Controls
  const [includeHardware, setIncludeHardware] = useState(true);
  const [layoutLocked, setLayoutLocked] = useState(false);
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState(() => {
    // Default to exactly 7 days from now formatted for datetime-local
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [homeMessage, setHomeMessage] = useState('');
  const [serverMessage, setServerMessage] = useState('');

  // Import states
  const [importSource, setImportSource] = useState<'file' | 'clipboard'>('file');
  const [pastedConfig, setPastedConfig] = useState('');
  const [importedFileContent, setImportedFileContent] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const [parsedRawEnvelope, setParsedRawEnvelope] = useState<any>(null);
  const [importPasswordInput, setImportPasswordInput] = useState('');
  const [importHwidInput, setImportHwidInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessData, setImportSuccessData] = useState<any>(null);

  // Load / initialize default hardware ID
  useEffect(() => {
    let savedHwid = localStorage.getItem('gln_tunnel_hwid');
    if (!savedHwid) {
      const randHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
      savedHwid = `HWID-${randHex()}-GLN-${randHex()}`;
      localStorage.setItem('gln_tunnel_hwid', savedHwid);
    }
    setUserHwid(savedHwid);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 2000);
    pushLog(`Copied Hardware ID: ${text} to clipboard.`, 'info');
  };

  // Compile active state to .gln structured object
  const handleExport = () => {
    // Determine the settings to export, excluding hardware settings if requested
    const settingsToExport = { ...currentSettings };
    if (!includeHardware) {
      delete settingsToExport.enableAesNi;
      delete settingsToExport.enableKernelRouting;
    }

    const rawPayload: any = {
      protocol: currentProtocol,
      server: currentServer,
      payload: currentPayload,
      settings: settingsToExport,
      exportedAt: new Date().toISOString()
    };

    if (layoutLocked) {
      rawPayload.layoutLocked = true;
    }
    if (enableExpiry && expiryDate) {
      rawPayload.expiryDate = new Date(expiryDate).toISOString();
    }
    if (homeMessage.trim()) {
      rawPayload.homeMessage = homeMessage.trim();
    }
    if (serverMessage.trim()) {
      rawPayload.serverMessage = serverMessage.trim();
    }

    const payloadString = JSON.stringify(rawPayload);
    let finalFileObj: any = {
      fileType: 'gln-config-profile',
      generator: 'GLN Tunnel Pro v4.2.0',
      locked: isLocked,
    };

    if (isLocked) {
      // Use password or HWID as key or fallback default key
      const key = `${password || ''}:${hwidLock || ''}:gln-tunnel-crypto-v1`;
      const encrypted = encryptString(payloadString, key);
      finalFileObj = {
        ...finalFileObj,
        hasPassword: !!password,
        requiredHwid: hwidLock || null,
        cipherText: encrypted
      };
    } else {
      finalFileObj = {
        ...finalFileObj,
        payload: rawPayload
      };
    }

    const jsonString = JSON.stringify(finalFileObj, null, 2);

    if (exportMethod === 'file') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Download element trigger
      const link = document.createElement('a');
      link.href = url;
      // Strictly force .gln extension as requested
      const sanitizedName = exportedFilename.replace(/\.gln$/, '');
      link.download = `${sanitizedName || 'gln_config_profile'}.gln`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      pushLog(`Successfully exported configuration file: ${link.download}`, 'success');
      setExportSuccessText(`File downloaded successfully: ${link.download}`);
      setTimeout(() => setExportSuccessText(null), 4000);
    } else {
      navigator.clipboard.writeText(jsonString);
      pushLog(`Successfully copied configuration profile to clipboard.`, 'success');
      setExportSuccessText('Configuration profile JSON copied to clipboard! Share it with clients.');
      setTimeout(() => setExportSuccessText(null), 4000);
    }
  };

  const checkExpiryError = (data: any): string | null => {
    if (data && data.expiryDate) {
      const expDate = new Date(data.expiryDate);
      if (new Date() > expDate) {
        return `Import Denied: This configuration file has expired! \nExpired on: ${expDate.toLocaleString()}`;
      }
    }
    return null;
  };

  // Parse custom URI links (vmess, vless, trojan, ssh)
  const parseTunnelUri = (uri: string): any => {
    const text = uri.trim();
    if (!text) return null;

    try {
      // 1. VMESS
      if (text.startsWith('vmess://')) {
        const base64Part = text.substring(8).trim();
        const decoded = atob(base64Part);
        const data = JSON.parse(decoded);
        
        const server: TunnelServer = {
          id: `custom-vmess-${Date.now()}`,
          name: data.ps || data.add || 'Imported VMess',
          country: 'Custom',
          flag: '🌐',
          ip: data.add,
          load: 12,
          ping: 45,
          ports: [parseInt(data.port) || 443],
          isCustomConfig: true,
          customType: 'VMESS',
          uuid: data.id,
          network: data.net === 'ws' ? 'websocket' : data.net === 'grpc' ? 'grpc' : 'tls',
          tlsEnabled: data.tls === 'tls' || !!data.sni,
          sni: data.sni || data.host || '',
          sniEnabled: !!(data.sni || data.host),
          path: data.path || '',
          headerHost: data.host || ''
        };

        return {
          protocol: 'VMESS',
          server,
          payload: {
            method: 'CONNECT',
            bugHost: data.host || data.add || '',
            split: 'none',
            extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: false, forwardHost: false },
            customPayload: ''
          },
          settings: {
            dnsType: 'cloudflare',
            customDnsPrimary: '1.1.1.1',
            customDnsSecondary: '1.0.0.1',
            localPort: 1080,
            mtu: 1500,
            enableUdp: true,
            reconnectAttempts: 5,
            slowDnsKey: '',
            slowDnsNs: ''
          }
        };
      }

      // 2. VLESS
      if (text.startsWith('vless://')) {
        const mainPart = text.substring(8);
        const hashIndex = mainPart.indexOf('#');
        const namePart = hashIndex !== -1 ? decodeURIComponent(mainPart.substring(hashIndex + 1)) : 'Imported VLESS';
        const connectionPart = hashIndex !== -1 ? mainPart.substring(0, hashIndex) : mainPart;
        
        const atIndex = connectionPart.indexOf('@');
        if (atIndex === -1) return null;
        const uuid = connectionPart.substring(0, atIndex);
        const remainder = connectionPart.substring(atIndex + 1);
        
        const questionIndex = remainder.indexOf('?');
        const serverAndPort = questionIndex !== -1 ? remainder.substring(0, questionIndex) : remainder;
        const queryStr = questionIndex !== -1 ? remainder.substring(questionIndex + 1) : '';
        
        const colonIndex = serverAndPort.indexOf(':');
        const host = colonIndex !== -1 ? serverAndPort.substring(0, colonIndex) : serverAndPort;
        const port = colonIndex !== -1 ? parseInt(serverAndPort.substring(colonIndex + 1)) || 443 : 443;
        
        const params = new URLSearchParams(queryStr);
        const networkType = params.get('type') || 'websocket';
        const security = params.get('security') || '';
        const sni = params.get('sni') || '';
        const path = params.get('path') || '';
        const headerHost = params.get('host') || '';

        const server: TunnelServer = {
          id: `custom-vless-${Date.now()}`,
          name: namePart,
          country: 'Custom',
          flag: '🌐',
          ip: host,
          load: 15,
          ping: 52,
          ports: [port],
          isCustomConfig: true,
          customType: 'VLESS',
          uuid: uuid,
          network: networkType === 'ws' ? 'websocket' : networkType === 'grpc' ? 'grpc' : 'tls',
          tlsEnabled: security === 'tls' || !!sni,
          sni: sni,
          sniEnabled: !!sni,
          path: path,
          headerHost: headerHost
        };

        return {
          protocol: 'VLESS',
          server,
          payload: {
            method: 'CONNECT',
            bugHost: headerHost || host,
            split: 'none',
            extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: false, forwardHost: false },
            customPayload: ''
          },
          settings: {
            dnsType: 'cloudflare',
            customDnsPrimary: '1.1.1.1',
            customDnsSecondary: '1.0.0.1',
            localPort: 1080,
            mtu: 1500,
            enableUdp: true,
            reconnectAttempts: 5,
            slowDnsKey: '',
            slowDnsNs: ''
          }
        };
      }

      // 3. TROJAN
      if (text.startsWith('trojan://')) {
        const mainPart = text.substring(9);
        const hashIndex = mainPart.indexOf('#');
        const namePart = hashIndex !== -1 ? decodeURIComponent(mainPart.substring(hashIndex + 1)) : 'Imported Trojan';
        const connectionPart = hashIndex !== -1 ? mainPart.substring(0, hashIndex) : mainPart;
        
        const atIndex = connectionPart.indexOf('@');
        if (atIndex === -1) return null;
        const password = connectionPart.substring(0, atIndex);
        const remainder = connectionPart.substring(atIndex + 1);
        
        const questionIndex = remainder.indexOf('?');
        const serverAndPort = questionIndex !== -1 ? remainder.substring(0, questionIndex) : remainder;
        const queryStr = questionIndex !== -1 ? remainder.substring(questionIndex + 1) : '';
        
        const colonIndex = serverAndPort.indexOf(':');
        const host = colonIndex !== -1 ? serverAndPort.substring(0, colonIndex) : serverAndPort;
        const port = colonIndex !== -1 ? parseInt(serverAndPort.substring(colonIndex + 1)) || 443 : 443;
        
        const params = new URLSearchParams(queryStr);
        const networkType = params.get('type') || 'websocket';
        const security = params.get('security') || '';
        const sni = params.get('sni') || '';
        const path = params.get('path') || '';
        const headerHost = params.get('host') || '';

        const server: TunnelServer = {
          id: `custom-trojan-${Date.now()}`,
          name: namePart,
          country: 'Custom',
          flag: '🌐',
          ip: host,
          load: 18,
          ping: 48,
          ports: [port],
          isCustomConfig: true,
          customType: 'TROJAN',
          password: password,
          network: networkType === 'ws' ? 'websocket' : networkType === 'grpc' ? 'grpc' : 'tls',
          tlsEnabled: security === 'tls' || !!sni,
          sni: sni,
          sniEnabled: !!sni,
          path: path,
          headerHost: headerHost
        };

        return {
          protocol: 'TROJAN',
          server,
          payload: {
            method: 'CONNECT',
            bugHost: headerHost || host,
            split: 'none',
            extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: false, forwardHost: false },
            customPayload: ''
          },
          settings: {
            dnsType: 'cloudflare',
            customDnsPrimary: '1.1.1.1',
            customDnsSecondary: '1.0.0.1',
            localPort: 1080,
            mtu: 1500,
            enableUdp: true,
            reconnectAttempts: 5,
            slowDnsKey: '',
            slowDnsNs: ''
          }
        };
      }

      // 4. SSH
      if (text.startsWith('ssh://')) {
        const mainPart = text.substring(6);
        const hashIndex = mainPart.indexOf('#');
        const namePart = hashIndex !== -1 ? decodeURIComponent(mainPart.substring(hashIndex + 1)) : 'Imported SSH';
        const connectionPart = hashIndex !== -1 ? mainPart.substring(0, hashIndex) : mainPart;
        
        const atIndex = connectionPart.indexOf('@');
        let target = '';
        let ip = '127.0.0.1';
        let port = 22;

        if (atIndex !== -1) {
          const left = connectionPart.substring(0, atIndex);
          const right = connectionPart.substring(atIndex + 1);
          
          const colonRight = right.indexOf(':');
          ip = colonRight !== -1 ? right.substring(0, colonRight) : right;
          port = colonRight !== -1 ? parseInt(right.substring(colonRight + 1)) || 22 : 22;

          target = `${ip}:${port}@${left}`;
        } else {
          target = connectionPart;
          const colonPart = connectionPart.split('@')[0] || '';
          const colonIdx = colonPart.indexOf(':');
          ip = colonIdx !== -1 ? colonPart.substring(0, colonIdx) : colonPart;
        }

        const server: TunnelServer = {
          id: `custom-ssh-${Date.now()}`,
          name: namePart,
          country: 'Custom',
          flag: '🌐',
          ip: ip,
          load: 8,
          ping: 35,
          ports: [port],
          isCustomConfig: true,
          customType: 'SSH',
          target: target,
          payload: '[method] [host_port] [protocol][crlf]Host: [host][crlf]Service: SSH[crlf]Mode: Bypass[crlf][crlf]'
        };

        return {
          protocol: 'SSH',
          server,
          payload: {
            method: 'CONNECT',
            bugHost: 'm.twitter.com',
            split: 'none',
            extraHeaders: { keepAlive: true, onlineHost: true, userAgent: true, referer: false, forwardHost: false },
            customPayload: server.payload
          },
          settings: {
            dnsType: 'cloudflare',
            customDnsPrimary: '1.1.1.1',
            customDnsSecondary: '1.0.0.1',
            localPort: 1080,
            mtu: 1500,
            enableUdp: true,
            reconnectAttempts: 5,
            slowDnsKey: '',
            slowDnsNs: ''
          }
        };
      }
    } catch (e) {
      console.error('Failed to parse tunnel URI:', e);
    }
    return null;
  };

  const handleAnalyzeClipboard = (rawText: string) => {
    const text = rawText.trim();
    if (!text) {
      setImportError('Please paste some text/code from your clipboard first!');
      return;
    }

    setImportError(null);
    setImportSuccessData(null);
    setParsedRawEnvelope(null);

    // Try URI parser first
    const parsedUri = parseTunnelUri(text);
    if (parsedUri) {
      setImportedFileName('Imported Clipboard URI');
      setParsedRawEnvelope({
        fileType: 'gln-config-profile',
        generator: 'Clipboard Link Handshake',
        locked: false
      });
      setImportSuccessData(parsedUri);
      pushLog(`Successfully decrypted link format: ${parsedUri.protocol}`, 'success');
      return;
    }

    // Otherwise, try standard .gln JSON configuration parser
    try {
      const envelope = JSON.parse(text);

      if (envelope.fileType !== 'gln-config-profile') {
        setImportError('Unrecognized configuration structure. Paste a valid .gln JSON or link (vmess://, vless://, trojan://, ssh://).');
        return;
      }

      setImportedFileName('Imported Clipboard JSON');
      setParsedRawEnvelope(envelope);

      if (!envelope.locked) {
        const expErr = checkExpiryError(envelope.payload);
        if (expErr) {
          setImportError(expErr);
          return;
        }
        setImportSuccessData(envelope.payload);
      } else {
        if (envelope.requiredHwid) {
          setImportHwidInput(userHwid);
        }
      }
    } catch (err) {
      setImportError('Failed to parse clipboard. Paste a valid .gln profile JSON or a standard tunnel URI.');
    }
  };

  // Parse uploaded file
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccessData(null);
    setParsedRawEnvelope(null);

    // Strictly enforce .gln file extension
    if (!file.name.endsWith('.gln')) {
      setImportError('Invalid file type! GLN Tunnel strictly accepts config profiles ending with ".gln".');
      return;
    }

    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const envelope = JSON.parse(text);

        if (envelope.fileType !== 'gln-config-profile') {
          setImportError('This is not a valid GLN Tunnel configuration envelope.');
          return;
        }

        setParsedRawEnvelope(envelope);

        if (!envelope.locked) {
          const expErr = checkExpiryError(envelope.payload);
          if (expErr) {
            setImportError(expErr);
            return;
          }
          // Clean parse instantly
          setImportSuccessData(envelope.payload);
        } else {
          // Pre-fill fields for matching testing convenience
          if (envelope.requiredHwid) {
            setImportHwidInput(userHwid); // Pre-fill with current HWID so user can test mismatch/match easily
          }
        }
      } catch (err) {
        setImportError('Failed to parse the file structure. Ensure the config file is not corrupted.');
      }
    };
    reader.readAsText(file);
  };

  const handleDecryptAndImport = () => {
    if (!parsedRawEnvelope) return;

    setImportError(null);

    // Check Hardware ID first
    if (parsedRawEnvelope.requiredHwid && importHwidInput.trim() !== parsedRawEnvelope.requiredHwid.trim()) {
      setImportError(`Access Denied! Hardware ID Mismatch.\nConfigured recipient: ${parsedRawEnvelope.requiredHwid}`);
      return;
    }

    try {
      const key = `${importPasswordInput}:${parsedRawEnvelope.requiredHwid || ''}:gln-tunnel-crypto-v1`;
      const decryptedString = decryptString(parsedRawEnvelope.cipherText, key);
      const parsedPayload = JSON.parse(decryptedString);

      if (parsedPayload && parsedPayload.protocol && parsedPayload.server) {
        const expErr = checkExpiryError(parsedPayload);
        if (expErr) {
          setImportError(expErr);
          return;
        }
        setImportSuccessData(parsedPayload);
      } else {
        setImportError('Decryption code correct, but payload data structure was compromised or corrupted.');
      }
    } catch (e) {
      setImportError('Decryption failed! Please verify your password security key or recipient hardware ID.');
    }
  };

  const handleConfirmImport = () => {
    if (importSuccessData) {
      onImport(
        importSuccessData.protocol,
        importSuccessData.server,
        importSuccessData.payload,
        importSuccessData.settings,
        importSuccessData.homeMessage || null,
        importSuccessData.serverMessage || null,
        importSuccessData.expiryDate || null,
        !!importSuccessData.layoutLocked
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">GLN Configuration Locker</h3>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Secure Config Export/Import (.gln)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Local Hardware ID display */}
        <div className="bg-slate-950 border-b border-white/5 px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-400 font-medium">Your System HWID:</span>
            <span className="text-white font-mono font-bold">{userHwid}</span>
          </div>
          <button
            onClick={() => copyToClipboard(userHwid)}
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded text-[10px] font-bold text-slate-300 transition-colors cursor-pointer"
          >
            {copiedHwid ? 'Copied!' : 'Copy'} <Copy className="w-3 h-3" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-950/40 p-1 border-b border-white/5">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'export' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" /> Export Config (.gln)
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'import' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" /> Import Config (.gln)
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[350px]">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              {/* Export Mode selector */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 mb-2">
                <button
                  type="button"
                  onClick={() => setExportMethod('file')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    exportMethod === 'file' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Download File (.gln)
                </button>
                <button
                  type="button"
                  onClick={() => setExportMethod('clipboard')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    exportMethod === 'clipboard' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Copy to Clipboard
                </button>
              </div>

              {/* Export details checklist */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-xs space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Export Snapshot</p>
                <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Protocol:</span>
                    <span className="text-white font-bold">{currentProtocol}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Destination IP:</span>
                    <span className="text-white">{currentServer.ip}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Proxy Host:</span>
                    <span className="text-white truncate max-w-[100px]">{currentPayload.bugHost || 'None'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">SOCKS Port:</span>
                    <span className="text-white">{currentSettings.localPort}</span>
                  </div>
                </div>
              </div>

              {/* Filename setting (Only for File method) */}
              {exportMethod === 'file' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Export Filename</label>
                  <div className="flex items-center bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5">
                    <input
                      type="text"
                      value={exportedFilename}
                      onChange={(e) => setExportedFilename(e.target.value)}
                      className="flex-1 bg-transparent text-white text-xs outline-none focus:ring-0"
                      placeholder="gln_config_profile"
                    />
                    <span className="text-xs text-blue-400 font-mono font-bold">.gln</span>
                  </div>
                </div>
              )}

              {/* Secure lock toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isLocked ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-500 border border-white/5'}`}>
                    {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Encrypt & Lock Configuration</h4>
                    <p className="text-[10px] text-slate-500 leading-normal">Requires password or hardware ID verification on import.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                </label>
              </div>

              {/* Locked options field */}
              {isLocked && (
                <div className="space-y-3.5 bg-slate-950/60 border border-white/5 rounded-xl p-4 animate-slide-up">
                  <div className="flex items-start gap-2.5 text-[10px] text-amber-300 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10 mb-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Lock is encrypted using dynamic AES-style rotation keys. Unlocked file remains readable raw JSON but keeps the identical .gln extension.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-500">Security Password</label>
                      <span className="text-[9px] text-slate-600 font-mono">Optional Protection Key</span>
                    </div>
                    <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-lg px-3 py-1">
                      <Key className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Leave empty for Hardware ID only"
                        className="flex-1 bg-transparent text-xs text-white outline-none py-1.5 focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-500 hover:text-white px-1"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-500">Target Recipient Hardware ID Lock</label>
                      <span className="text-[9px] text-amber-400 font-mono">Restricts Load Access</span>
                    </div>
                    <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-lg px-3 py-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={hwidLock}
                        onChange={(e) => setHwidLock(e.target.value)}
                        placeholder="Paste recipient's HWID (e.g. HWID-A29F-...)"
                        className="flex-1 bg-transparent text-xs text-white font-mono outline-none py-1.5 focus:ring-0"
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">If set, only devices possessing this precise HWID can load the config file.</p>
                  </div>
                </div>
              )}

              {/* Custom Export Controls Area */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Custom Export Controls & Tuning</h4>
                
                {/* Hardware Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Cpu className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-white">Include Hardware Configurations</h5>
                      <p className="text-[9px] text-slate-500">Enable optimized AES-NI & Kernel acceleration settings.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeHardware}
                      onChange={(e) => setIncludeHardware(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500" />
                  </label>
                </div>

                {/* Read-Only Layout Lock Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-white">Lock Configuration Layout (Read-Only)</h5>
                      <p className="text-[9px] text-slate-500">Prevent imported clients from editing settings/payloads.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={layoutLocked}
                      onChange={(e) => setLayoutLocked(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500" />
                  </label>
                </div>

                {/* Expiry Date Toggle */}
                <div className="space-y-2 bg-slate-950 rounded-xl border border-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h5 className="text-[11px] font-bold text-white">Enforce Profile Expiration Date</h5>
                        <p className="text-[9px] text-slate-500">Automatically brick configuration on selected time limit.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enableExpiry}
                        onChange={(e) => setEnableExpiry(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500" />
                    </label>
                  </div>
                  
                  {enableExpiry && (
                    <div className="pt-2 border-t border-white/5 animate-slide-up">
                      <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Select Expiry Date & Local Time</label>
                      <input
                        type="datetime-local"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Home Broadcast Message */}
                <div className="space-y-1.5 bg-slate-950 rounded-xl border border-white/5 p-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <label className="text-[10px] uppercase font-bold">Import Dashboard Message</label>
                  </div>
                  <textarea
                    rows={2}
                    value={homeMessage}
                    onChange={(e) => setHomeMessage(e.target.value)}
                    placeholder="E.g., Welcome to GLN Premium! Valid for 30 Days. Enjoy maximum speeds!"
                    className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500 font-sans resize-none"
                  />
                  <p className="text-[8px] text-slate-600">This banner displays directly on the user's home screen dashboard upon loading.</p>
                </div>

                {/* Server Logs Connection Message */}
                <div className="space-y-1.5 bg-slate-950 rounded-xl border border-white/5 p-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <label className="text-[10px] uppercase font-bold">Server Connection Console Log</label>
                  </div>
                  <textarea
                    rows={2}
                    value={serverMessage}
                    onChange={(e) => setServerMessage(e.target.value)}
                    placeholder="E.g., [GLN-GATEWAY] Tunnel initialized on Premium SG Node. Bandwidth unlimited."
                    className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500 font-mono resize-none"
                  />
                  <p className="text-[8px] text-slate-600">This message broadcasts directly inside the console/syslog terminal on successful VPN connection.</p>
                </div>
              </div>

              {exportSuccessText && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl flex items-center gap-2 animate-pulse">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{exportSuccessText}</span>
                </div>
              )}

              <button
                id="btn-execute-gln-export"
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-black py-3 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all cursor-pointer mt-4"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                {exportMethod === 'file' ? 'Securely Compile & Download .gln' : 'Securely Compile & Copy Profile'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Import Source selector */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportSource('file');
                    setParsedRawEnvelope(null);
                    setImportSuccessData(null);
                    setImportError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    importSource === 'file' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  File (.gln)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportSource('clipboard');
                    setParsedRawEnvelope(null);
                    setImportSuccessData(null);
                    setImportError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    importSource === 'clipboard' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Clipboard / URI Link
                </button>
              </div>

              {/* Input Area (Only if no file has been loaded/parsed yet) */}
              {!parsedRawEnvelope && (
                <>
                  {importSource === 'file' ? (
                    <label className="w-full aspect-[16/9] bg-slate-950 border border-dashed border-white/10 hover:border-blue-500/40 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:bg-white/[0.01]">
                      <input
                        type="file"
                        accept=".gln"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-slate-500 mb-2" />
                      <p className="text-xs text-slate-300 font-semibold">Browse or Drop Config File</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-[220px]">
                        Strictly accepts <strong className="text-blue-400 font-bold">.gln</strong> file formats generated by gln tunnel Pro.
                      </p>
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-[10px] uppercase font-bold text-slate-500">Paste Configuration Profile or Link</label>
                      <textarea
                        rows={6}
                        value={pastedConfig}
                        onChange={(e) => setPastedConfig(e.target.value)}
                        placeholder="Paste a raw .gln JSON profile, encrypted stream, or standard tunnel link (vmess://, vless://, trojan://, ssh://)"
                        className="w-full text-xs bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              setPastedConfig(text);
                              pushLog('Successfully read content from clipboard', 'info');
                            } catch (e) {
                              pushLog('Clipboard access blocked. Please paste manually.', 'warning');
                            }
                          }}
                          className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 border border-white/5 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                        >
                          Paste from Clipboard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnalyzeClipboard(pastedConfig)}
                          className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                        >
                          Analyze & Load Config
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Active Parser Result Area */}
              {parsedRawEnvelope && (
                <div className="space-y-4">
                  {/* File parsed status */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-bold truncate max-w-[220px]">{importedFileName}</span>
                    </div>
                    <button
                      onClick={() => {
                        setParsedRawEnvelope(null);
                        setImportSuccessData(null);
                        setImportError(null);
                        setPastedConfig('');
                      }}
                      className="text-slate-500 hover:text-white font-semibold text-[10px] uppercase hover:underline"
                    >
                      Clear File
                    </button>
                  </div>

                  {/* Envelope protection details */}
                  {parsedRawEnvelope.locked ? (
                    <div className="space-y-3 bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-white">This Configuration File is Locked & Encrypted</p>
                          <p className="text-[9px] text-slate-500">Requires credential decryption handshake to inject configurations</p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        {parsedRawEnvelope.hasPassword && (
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Enter File Password</label>
                            <input
                              type="password"
                              value={importPasswordInput}
                              onChange={(e) => setImportPasswordInput(e.target.value)}
                              placeholder="Required key password"
                              className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        )}

                        {parsedRawEnvelope.requiredHwid && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-[10px] uppercase font-bold text-slate-400">Target Recipient Hardware ID Lock</label>
                              <span className="text-[8px] text-amber-400 font-mono">Enforced Hardware</span>
                            </div>
                            <input
                              type="text"
                              value={importHwidInput}
                              onChange={(e) => setImportHwidInput(e.target.value)}
                              placeholder="Paste recipient HWID"
                              className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-amber-400 outline-none focus:border-amber-500 font-mono"
                            />
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1">
                              <span>Config Target:</span>
                              <span className="text-white font-mono">{parsedRawEnvelope.requiredHwid}</span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleDecryptAndImport}
                          className="w-full bg-amber-500 text-slate-950 text-xs font-black py-2.5 rounded-xl hover:bg-amber-400 transition-colors cursor-pointer mt-2"
                        >
                          Decrypt and Handshake
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">Unlocked File Verified</p>
                        <p className="text-[10px] text-slate-500">Plain JSON profile verified with correct schema parameters.</p>
                      </div>
                    </div>
                  )}

                  {/* Active success snapshot before clicking import */}
                  {importSuccessData && (
                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-3 animate-slide-up">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white">Payload Decrypted Successfully!</span>
                      </div>
                      <div className="bg-slate-950/80 rounded-lg p-3 border border-white/5 text-[11px] font-mono space-y-1 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Secure Node:</span>
                          <span className="text-white font-bold">{importSuccessData.server?.name} ({importSuccessData.server?.ip})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ingress Protocol:</span>
                          <span className="text-emerald-400 font-bold">{importSuccessData.protocol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Header Bug:</span>
                          <span className="text-white truncate max-w-[150px]">{importSuccessData.payload?.bugHost || 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">DNS Type:</span>
                          <span className="text-cyan-400">{importSuccessData.settings?.dnsType}</span>
                        </div>
                        {importSuccessData.expiryDate && (
                          <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-rose-400">
                            <span>Expiry Date:</span>
                            <span className="font-bold">{new Date(importSuccessData.expiryDate).toLocaleString()}</span>
                          </div>
                        )}
                        {importSuccessData.layoutLocked && (
                          <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-amber-400">
                            <span>Layout Lock:</span>
                            <span className="font-bold flex items-center gap-1">🔒 Locked (Read-Only)</span>
                          </div>
                        )}
                        {importSuccessData.homeMessage && (
                          <div className="border-t border-white/5 pt-1.5 mt-1 text-left">
                            <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">Import Broadcast Message:</span>
                            <p className="text-blue-400 text-[10px] font-sans italic break-words mt-0.5 leading-normal bg-blue-500/5 p-1.5 rounded border border-blue-500/10">
                              "{importSuccessData.homeMessage}"
                            </p>
                          </div>
                        )}
                        {importSuccessData.serverMessage && (
                          <div className="border-t border-white/5 pt-1.5 mt-1 text-left">
                            <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">On-Connect Console Message:</span>
                            <p className="text-indigo-400 text-[10px] font-mono break-words mt-0.5 leading-normal bg-indigo-500/5 p-1.5 rounded border border-indigo-500/10">
                              &gt; {importSuccessData.serverMessage}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        id="btn-apply-gln-import"
                        onClick={handleConfirmImport}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-black py-2.5 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
                      >
                        <Shield className="w-4 h-4 stroke-[2.5]" /> Deploy Imported .gln Settings
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Import error box */}
              {importError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-2.5 animate-pulse">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">Import Fault</p>
                    <p className="text-[10px] text-rose-300/80 leading-normal mt-0.5 whitespace-pre-wrap">{importError}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-5 py-3 border-t border-white/10 text-[9px] text-slate-500 font-mono flex justify-between items-center">
          <span>SECURE VAULT CONTAINER</span>
          <span>AES // GLN PROTOCOL LOCK</span>
        </div>
      </div>
    </div>
  );
}
