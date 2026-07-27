import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface VisualChartProps {
  isConnected: boolean;
  isConnecting: boolean;
  uploadSpeed: number; // KB/s
  downloadSpeed: number; // KB/s
}

export default function VisualChart({ isConnected, isConnecting, uploadSpeed, downloadSpeed }: VisualChartProps) {
  const [downloadHistory, setDownloadHistory] = useState<number[]>(Array(20).fill(0));
  const [uploadHistory, setUploadHistory] = useState<number[]>(Array(20).fill(0));

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isConnected) {
      interval = setInterval(() => {
        setDownloadHistory((prev) => {
          const next = [...prev.slice(1), downloadSpeed];
          return next;
        });
        setUploadHistory((prev) => {
          const next = [...prev.slice(1), uploadSpeed];
          return next;
        });
      }, 500);
    } else {
      // Slow decay or set to 0
      setDownloadHistory((prev) => [...prev.slice(1), 0]);
      setUploadHistory((prev) => [...prev.slice(1), 0]);
    }

    return () => clearInterval(interval);
  }, [isConnected, downloadSpeed, uploadSpeed]);

  // Convert array of values to SVG path points
  const getSvgPath = (data: number[], maxVal: number) => {
    if (data.length === 0) return { linePath: '', areaPath: '' };
    const width = 360;
    const height = 80;
    const padding = 5;
    const scaleX = width / (data.length - 1);
    
    // Normalize based on max value in history or fallback
    const max = Math.max(...data, maxVal) || 10;
    const points = data.map((val, i) => {
      const x = i * scaleX;
      // Invert Y axis for SVG (0,0 is top-left)
      const y = height - padding - (val / max) * (height - padding * 2);
      return `${x},${y}`;
    });

    return {
      linePath: `M ${points.join(' L ')}`,
      areaPath: `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`,
    };
  };

  const dlPaths = getSvgPath(downloadHistory, 500);
  const ulPaths = getSvgPath(uploadHistory, 150);

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${Math.round(kbps)} KB/s`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-sans font-semibold text-slate-800 text-sm">Real-Time Traffic Stream</h4>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
            <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">Rx (Down)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" />
            <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">Tx (Up)</span>
          </div>
        </div>
      </div>

      {/* Speed Readout Badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded text-emerald-600">
              <ArrowDown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">DOWNLOAD</span>
              <span className="font-mono text-sm font-bold text-slate-700">
                {isConnected ? formatSpeed(downloadSpeed) : '0 KB/s'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500/10 p-1.5 rounded text-cyan-600">
              <ArrowUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">UPLOAD</span>
              <span className="font-mono text-sm font-bold text-slate-700">
                {isConnected ? formatSpeed(uploadSpeed) : '0 KB/s'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Sparkline Charts */}
      <div className="relative h-24 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
        {/* Network Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-10" />

        {isConnected ? (
          <>
            {/* SVG Streams */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 80" preserveAspectRatio="none">
              {/* Defs for gradients */}
              <defs>
                <linearGradient id="dl-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="ul-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Download Stream */}
              <path d={dlPaths.areaPath} fill="url(#dl-grad)" />
              <path d={dlPaths.linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

              {/* Upload Stream */}
              <path d={ulPaths.areaPath} fill="url(#ul-grad)" />
              <path d={ulPaths.linePath} fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isConnecting ? (
              <span className="text-[11px] font-mono text-amber-400 animate-pulse uppercase tracking-wider font-bold">
                Awaiting connection tunnel sync...
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-600 italic">
                Tunnel offline. Real-time logging idle.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
