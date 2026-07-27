import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { TunnelServer } from '../types';
import { Camera, Upload, AlertCircle, CheckCircle, HelpCircle, RefreshCw, X, Shield, Plus, QrCode } from 'lucide-react';

interface QrScannerProps {
  onImport: (server: TunnelServer) => void;
  onClose: () => void;
}

const DEFAULT_DEMO_CONFIGS = [
  {
    name: 'NeoTokyo Quantum Node',
    country: 'Japan',
    flag: '🇯🇵',
    ip: '172.105.10.99',
    load: 15,
    ping: 72,
    ports: [22, 443, 80],
  },
  {
    name: 'Frankfurt Cyber Bunker',
    country: 'Germany',
    flag: '🇩🇪',
    ip: '82.165.4.120',
    load: 22,
    ping: 19,
    ports: [22, 443, 8080],
  },
  {
    name: 'Jakarta Stealth Gateway',
    country: 'Indonesia',
    flag: '🇮🇩',
    ip: '103.150.90.4',
    load: 40,
    ping: 11,
    ports: [22, 443, 3128],
  },
];

export default function QrScanner({ onImport, onClose }: QrScannerProps) {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'demo'>('demo');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [successData, setSuccessData] = useState<TunnelServer | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [hasCameraPermissionStarted, setHasCameraPermissionStarted] = useState<boolean>(false);

  // Demo generator state
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoPorts, setDemoPorts] = useState('22,443,80');
  const [demoName, setDemoName] = useState(DEFAULT_DEMO_CONFIGS[0].name);
  const [demoIp, setDemoIp] = useState(DEFAULT_DEMO_CONFIGS[0].ip);
  const [demoCountry, setDemoCountry] = useState(DEFAULT_DEMO_CONFIGS[0].country);
  const [demoFlag, setDemoFlag] = useState(DEFAULT_DEMO_CONFIGS[0].flag);

  const qrRegionId = 'html5qr-code-full-region';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Parse QR string content
  const parseQrContent = (text: string): TunnelServer | null => {
    try {
      const cleanText = text.trim();
      
      // Pattern 1: JSON format
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        const parsed = JSON.parse(cleanText);
        if (parsed.name && parsed.ip) {
          return {
            id: parsed.id || `custom-${Date.now()}`,
            name: parsed.name,
            country: parsed.country || 'Custom Location',
            flag: parsed.flag || '🌐',
            ip: parsed.ip,
            load: parsed.load || 10,
            ping: parsed.ping || 50,
            ports: Array.isArray(parsed.ports) ? parsed.ports : [22, 443],
          };
        }
      }

      // Pattern 2: Custom URI Scheme opentunnel://import?name=...&ip=...
      if (cleanText.startsWith('opentunnel://import')) {
        const url = new URL(cleanText);
        const params = url.searchParams;
        const name = params.get('name');
        const ip = params.get('ip');
        if (name && ip) {
          const portsStr = params.get('ports') || '22,443';
          const ports = portsStr.split(',').map(p => parseInt(p) || 22);
          return {
            id: params.get('id') || `custom-${Date.now()}`,
            name: decodeURIComponent(name),
            country: decodeURIComponent(params.get('country') || 'Custom Location'),
            flag: decodeURIComponent(params.get('flag') || '🌐'),
            ip: ip,
            load: parseInt(params.get('load') || '15'),
            ping: parseInt(params.get('ping') || '45'),
            ports: ports,
          };
        }
      }

      // Pattern 3: Simple proxy style ip:port@name
      if (cleanText.includes('@')) {
        const [conn, name] = cleanText.split('@');
        const [ip, portStr] = conn.split(':');
        if (ip && name) {
          return {
            id: `custom-${Date.now()}`,
            name: name.trim(),
            country: 'External Server',
            flag: '⚡',
            ip: ip.trim(),
            load: 20,
            ping: 60,
            ports: [parseInt(portStr) || 22],
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse QR content', e);
    }
    return null;
  };

  // Compile standard testing QR URL based on generator form values
  const getDemoQrUrl = () => {
    const config = {
      id: `demo-${Date.now()}`,
      name: demoName,
      country: demoCountry,
      flag: demoFlag,
      ip: demoIp,
      load: 10,
      ping: 25,
      ports: demoPorts.split(',').map(p => parseInt(p.trim()) || 80),
    };
    const payload = JSON.stringify(config);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(payload)}`;
  };

  // Start the HTML5 QR camera scanner
  const startCamera = async (cameraId: string) => {
    setScannerError(null);
    setSuccessData(null);
    setIsScanning(true);

    try {
      // Ensure any existing instance is cleaned up first
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (_) {}
      }

      const html5QrCode = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          // Success callback
          const server = parseQrContent(decodedText);
          if (server) {
            setSuccessData(server);
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate(100);
            // Auto stop camera
            html5QrCode.stop().then(() => {
              setIsScanning(false);
            }).catch(err => console.error(err));
          } else {
            setScannerError('QR recognized but format is not a valid OpenTunnel config.');
          }
        },
        (errorMessage) => {
          // Silent callback during scan loop unless desired
        }
      );
    } catch (err: any) {
      console.warn('Camera startup warning/error handled gracefully:', err);
      setScannerError(`Camera Access Failed: ${err.message || err}. Ensure page permissions are granted.`);
      setIsScanning(false);
    }
  };

  // Stop camera scan
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping QR scanner handled gracefully', err);
      }
    }
    setIsScanning(false);
  };

  // Refresh cameras list
  const requestCameraAccess = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      if (devices.length > 0) {
        setSelectedCameraId(devices[0].id);
        startCamera(devices[0].id);
      } else {
        setScannerError('No system cameras detected on this device.');
      }
    } catch (err: any) {
      setScannerError('Camera permissions declined or not supported. You can upload an image instead.');
    }
  };

  useEffect(() => {
    if (activeMode === 'camera' && hasCameraPermissionStarted) {
      requestCameraAccess();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [activeMode, hasCameraPermissionStarted]);

  // Handle image file upload decoding
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerError(null);
    setSuccessData(null);

    const html5QrCode = new Html5Qrcode(qrRegionId);
    html5QrCode
      .scanFile(file, true)
      .then((decodedText) => {
        const server = parseQrContent(decodedText);
        if (server) {
          setSuccessData(server);
        } else {
          setScannerError('Decoded QR successfully, but configuration schema was unrecognized.');
        }
      })
      .catch((err) => {
        setScannerError('Failed to decode QR code from image. Make sure the QR is clear and well-lit.');
        console.error(err);
      });
  };

  // Apply imported server
  const handleConfirmImport = () => {
    if (successData) {
      onImport(successData);
    }
  };

  // Custom demo server selector helper
  const handleDemoPresetSelect = (idx: number) => {
    setDemoIndex(idx);
    const preset = DEFAULT_DEMO_CONFIGS[idx];
    setDemoName(preset.name);
    setDemoIp(preset.ip);
    setDemoCountry(preset.country);
    setDemoFlag(preset.flag);
    setDemoPorts(preset.ports.join(','));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Import QR Server config</h3>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Secure Gateway Handshake</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab mode toggle */}
        <div className="flex bg-slate-950 p-1 border-b border-white/5">
          <button
            onClick={() => setActiveMode('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'camera' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" /> Live Camera
          </button>
          <button
            onClick={() => setActiveMode('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'upload' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload Image
          </button>
          <button
            onClick={() => setActiveMode('demo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'demo' ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" /> QR Simulator
          </button>
        </div>

        {/* Content Body Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px]">
          {/* Status Message Overlay */}
          {scannerError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Decoder Error</p>
                <p className="text-[11px] text-rose-300/80 leading-normal mt-0.5">{scannerError}</p>
              </div>
            </div>
          )}

          {successData && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Valid Profile Detected</p>
                  <p className="text-[10px] text-emerald-400 font-mono">OpenTunnel Scheme Verified</p>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-lg p-3 border border-white/5 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Node Name:</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <span>{successData.flag}</span>
                    {successData.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination IP:</span>
                  <span className="text-white">{successData.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Region:</span>
                  <span className="text-white">{successData.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ports:</span>
                  <span className="text-emerald-400 font-bold">{successData.ports.join(', ')}</span>
                </div>
              </div>

              <button
                id="btn-confirm-qr-import"
                onClick={handleConfirmImport}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black py-2.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Instantly Load & Select Config
              </button>
            </div>
          )}

          {/* Core mode content */}
          {activeMode === 'camera' && !successData && (
            <div className="flex flex-col items-center justify-center space-y-4">
              {!hasCameraPermissionStarted ? (
                <div className="text-center p-6 bg-slate-950/60 rounded-2xl border border-white/5 max-w-[320px] space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                    <Camera className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Live Camera Scanner</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                      To scan physical config QR codes directly using your device camera, authorize permissions by clicking the button below.
                    </p>
                  </div>
                  <button
                    onClick={() => setHasCameraPermissionStarted(true)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold py-2 rounded-xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] cursor-pointer"
                  >
                    Activate Device Camera
                  </button>
                </div>
              ) : (
                <>
                  {/* HTML5 Qrcode Viewport */}
                  <div className="relative w-full aspect-square max-w-[280px] bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
                    <div id={qrRegionId} className="w-full h-full object-cover rounded-2xl"></div>

                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center px-4 space-y-3">
                        <Camera className="w-8 h-8 text-slate-500 animate-pulse" />
                        <p className="text-xs text-slate-300 font-semibold">Camera Access Requested</p>
                        <p className="text-[10px] text-slate-500 max-w-[180px]">
                          Grant system camera permissions to scan gateway credentials.
                        </p>
                        <button
                          onClick={requestCameraAccess}
                          className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Retry Camera Handshake
                        </button>
                      </div>
                    )}

                    {isScanning && (
                      <>
                        {/* Retro cyber scanning lasers */}
                        <div className="absolute inset-x-4 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-bounce top-1/2"></div>
                        <div className="absolute inset-4 border-2 border-emerald-500/20 rounded-xl pointer-events-none"></div>
                      </>
                    )}
                  </div>

                  {/* Camera selection dropdown */}
                  {cameras.length > 1 && (
                    <div className="w-full max-w-[280px]">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Camera Lens</label>
                      <select
                        value={selectedCameraId}
                        onChange={(e) => {
                          setSelectedCameraId(e.target.value);
                          startCamera(e.target.value);
                        }}
                        className="w-full text-xs bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-300 outline-none focus:border-emerald-500 font-mono"
                      >
                        {cameras.map((camera, i) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `Camera Device ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeMode === 'upload' && !successData && (
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Dropzone file upload */}
              <label className="w-full max-w-[280px] aspect-square bg-slate-950 border border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:bg-white/[0.01]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-xs text-slate-300 font-semibold">Drop image or Browse</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[180px]">
                  Select an image, screenshot, or photo containing the OpenTunnel QR Code.
                </p>
              </label>

              {/* Paste raw code option */}
              <div className="w-full space-y-2 border-t border-white/5 pt-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-bold text-slate-500">Paste Configuration Text</label>
                  <span className="text-[9px] text-slate-600 font-mono">JSON or URI Scheme</span>
                </div>
                <textarea
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder='Paste JSON: {"name": "My Node", "ip": "1.2.3.4", ...}'
                  rows={3}
                  className="w-full font-mono text-[10px] bg-slate-950 border border-white/10 rounded-xl p-3 text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <button
                  onClick={() => {
                    const server = parseQrContent(manualCode);
                    if (server) {
                      setSuccessData(server);
                    } else {
                      setScannerError('Could not decode the configuration text. Check syntax format.');
                    }
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-300 text-[11px] font-bold py-2 rounded-lg transition-colors"
                >
                  Verify Configuration Text
                </button>
              </div>
            </div>
          )}

          {activeMode === 'demo' && (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex gap-2.5">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-normal">
                  No physical QR code on hand? Use this simulator to customize a config profile, render its real QR image, and instantly simulate a successful camera scan.
                </p>
              </div>

              {/* Preset selection buttons */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Preset Server Blueprints</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEFAULT_DEMO_CONFIGS.map((config, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDemoPresetSelect(idx)}
                      className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border text-center transition-all ${
                        demoIndex === idx
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {config.flag} {config.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive editor */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-white/5">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Custom Node Name</label>
                  <input
                    type="text"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-white/5 rounded p-1.5 text-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">IP Address</label>
                  <input
                    type="text"
                    value={demoIp}
                    onChange={(e) => setDemoIp(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-white/5 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Country</label>
                  <input
                    type="text"
                    value={demoCountry}
                    onChange={(e) => setDemoCountry(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-white/5 rounded p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Active Ports (split)</label>
                  <input
                    type="text"
                    value={demoPorts}
                    onChange={(e) => setDemoPorts(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-white/5 rounded p-1.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Rendered Live QR Code Image */}
              <div className="flex flex-col items-center justify-center py-4 border-t border-white/5">
                <div className="bg-white p-3 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white">
                  <img
                    src={getDemoQrUrl()}
                    alt="Simulated QR Code"
                    className="w-40 h-40 object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-wider">
                  Live QR Render (API Server)
                </p>

                <button
                  id="btn-simulate-qr-scan"
                  onClick={() => {
                    const server: TunnelServer = {
                      id: `simulated-${Date.now()}`,
                      name: demoName,
                      country: demoCountry,
                      flag: demoFlag,
                      ip: demoIp,
                      load: 5,
                      ping: 18,
                      ports: demoPorts.split(',').map(p => parseInt(p.trim()) || 80),
                    };
                    setSuccessData(server);
                    if (navigator.vibrate) navigator.vibrate(50);
                  }}
                  className="mt-4 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 px-5 rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Direct Inject & Simulate Scan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info log */}
        <div className="bg-slate-950 px-5 py-3 border-t border-white/10 text-[9px] text-slate-500 font-mono flex justify-between items-center">
          <span>SECURE HANDSHAKE COMPLIANT</span>
          <span>CHACHA20 // OPENTUNNEL</span>
        </div>
      </div>
    </div>
  );
}
