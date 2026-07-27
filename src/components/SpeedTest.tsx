import { useState, useEffect } from 'react';
import { SpeedTestState } from '../types';
import { Play, RotateCcw, Activity, ArrowDown, ArrowUp, Wifi } from 'lucide-react';

interface SpeedTestProps {
  isConnected: boolean;
  basePing: number;
}

export default function SpeedTest({ isConnected, basePing }: SpeedTestProps) {
  const [state, setState] = useState<SpeedTestState>({
    phase: 'idle',
    ping: 0,
    download: 0,
    upload: 0,
    progress: 0,
  });

  const [currentSpeed, setCurrentSpeed] = useState(0);

  useEffect(() => {
    if (!isConnected && state.phase !== 'idle') {
      // Reset if we disconnect
      setState({ phase: 'idle', ping: 0, download: 0, upload: 0, progress: 0 });
      setCurrentSpeed(0);
    }
  }, [isConnected]);

  const runTest = async () => {
    if (!isConnected) return;

    // Phase 1: Ping
    setState({ phase: 'ping', ping: 0, download: 0, upload: 0, progress: 0 });
    setCurrentSpeed(0);

    await sleep(1500);
    const finalPing = Math.round(basePing + Math.random() * 15 - 5);
    setState(s => ({ ...s, phase: 'download', ping: finalPing, progress: 30 }));

    // Phase 2: Download
    const maxDownload = 40 + Math.random() * 45; // 40-85 MB/s
    let downloadTicks = 0;
    while (downloadTicks < 20) {
      downloadTicks++;
      const speed = maxDownload * (0.3 + 0.7 * Math.sin((downloadTicks / 20) * (Math.PI / 2)) + Math.random() * 0.15);
      setCurrentSpeed(Math.min(speed, maxDownload + 5));
      setState(s => ({ ...s, progress: 30 + (downloadTicks / 20) * 35 }));
      await sleep(100);
    }
    const finalDownload = maxDownload;
    setCurrentSpeed(0);
    setState(s => ({ ...s, phase: 'upload', download: finalDownload, progress: 65 }));

    // Phase 3: Upload
    const maxUpload = 12 + Math.random() * 15; // 12-27 MB/s
    let uploadTicks = 0;
    while (uploadTicks < 20) {
      uploadTicks++;
      const speed = maxUpload * (0.4 + 0.6 * Math.sin((uploadTicks / 20) * (Math.PI / 2)) + Math.random() * 0.12);
      setCurrentSpeed(Math.min(speed, maxUpload + 3));
      setState(s => ({ ...s, progress: 65 + (uploadTicks / 20) * 35 }));
      await sleep(100);
    }
    const finalUpload = maxUpload;
    setCurrentSpeed(0);
    setState(s => ({
      ...s,
      phase: 'completed',
      upload: finalUpload,
      progress: 100,
    }));
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Determine current active display value
  const displayValue = state.phase === 'download' ? currentSpeed : state.phase === 'upload' ? currentSpeed : 0;
  const maxScaleValue = state.phase === 'upload' ? 40 : 100;
  const percentageOfMax = Math.min((displayValue / maxScaleValue) * 100, 100);

  // SVG Gauge Calculations
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentageOfMax / 100) * circumference;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          <h3 className="font-sans font-semibold text-slate-800 text-sm">Tunnel Speed Performance</h3>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          Carrier Ingress Test
        </span>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center px-4">
          <Wifi className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
          <p className="text-xs font-semibold text-slate-600 mb-1">Tunnel Offline</p>
          <p className="text-[11px] text-slate-400 max-w-[200px]">
            Please establish an active secure tunnel connection to run bandwidth diagnostics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center relative">
            {/* Speed Gauge SVG */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-slate-100"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Active Indicator Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className={`${
                    state.phase === 'download' ? 'stroke-emerald-500' : 'stroke-cyan-500'
                  } transition-all duration-100 ease-out`}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={state.phase === 'idle' || state.phase === 'completed' || state.phase === 'ping' ? circumference : strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              {/* Inside Text */}
              <div className="absolute flex flex-col items-center text-center">
                {state.phase === 'idle' && (
                  <span className="text-xs font-bold text-slate-400">READY</span>
                )}
                {state.phase === 'ping' && (
                  <span className="text-xs font-bold text-amber-500 animate-pulse">PING...</span>
                )}
                {(state.phase === 'download' || state.phase === 'upload') && (
                  <>
                    <span className="text-3xl font-mono font-black tracking-tight text-slate-800">
                      {displayValue.toFixed(1)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">MB/s</span>
                  </>
                )}
                {state.phase === 'completed' && (
                  <span className="text-xs font-bold text-emerald-600">FINISHED</span>
                )}
              </div>
            </div>

            {/* Core Control Button */}
            {state.phase === 'idle' || state.phase === 'completed' ? (
              <button
                id="btn-run-speed-test"
                onClick={runTest}
                className="mt-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {state.phase === 'completed' ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {state.phase === 'completed' ? 'Re-run Diagnostics' : 'Measure Speed'}
              </button>
            ) : (
              <div className="w-full max-w-[120px] bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Results Details Grid */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-lg text-center font-mono">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-0.5 uppercase">Ping</p>
              <p className="text-xs font-bold text-slate-700">
                {state.phase === 'idle' ? '—' : `${state.ping || '...'} ms`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-0.5 uppercase flex items-center justify-center gap-0.5">
                <ArrowDown className="w-3 h-3 text-emerald-500" /> Down
              </p>
              <p className="text-xs font-bold text-slate-700">
                {state.phase === 'idle' || (state.phase === 'ping' && state.download === 0)
                  ? '—'
                  : state.download > 0
                  ? `${state.download.toFixed(1)} MB/s`
                  : `${currentSpeed.toFixed(1)} ...`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-0.5 uppercase flex items-center justify-center gap-0.5">
                <ArrowUp className="w-3 h-3 text-cyan-500" /> Up
              </p>
              <p className="text-xs font-bold text-slate-700">
                {state.phase !== 'upload' && state.phase !== 'completed'
                  ? '—'
                  : state.upload > 0
                  ? `${state.upload.toFixed(1)} MB/s`
                  : `${currentSpeed.toFixed(1)} ...`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
