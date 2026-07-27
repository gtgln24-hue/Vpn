import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Wifi, 
  Zap, 
  Sparkles, 
  Gauge, 
  Clock, 
  Sliders, 
  RefreshCw, 
  Terminal, 
  HelpCircle,
  Play,
  CheckCircle,
  TrendingDown,
  ShieldAlert
} from 'lucide-react';
import { TunnelServer, TunnelProtocol } from '../types';

interface PingLatencyMonitorProps {
  isConnected: boolean;
  selectedServer?: TunnelServer;
  selectedProtocol?: TunnelProtocol;
  pushLog?: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

interface PingDataPoint {
  timeLabel: string; // e.g. "12:34:56"
  latency: number;   // ms
  isLost: boolean;
  seq: number;
}

type ProfileType = 'fiber' | 'lte' | 'satellite' | 'congested';

export default function PingLatencyMonitor({
  isConnected,
  selectedServer,
  selectedProtocol = 'SSH',
  pushLog,
}: PingLatencyMonitorProps) {
  // Config state
  const [profile, setProfile] = useState<ProfileType>('fiber');
  const [optimizeActive, setOptimizeActive] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<PingDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Terminal logs state specifically for ping diagnostics
  const [pingConsoleLogs, setPingConsoleLogs] = useState<string[]>([]);
  
  // Track continuous sequence number
  const seqRef = useRef<number>(1);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Derive target base ping from selectedServer
  const serverBasePing = selectedServer?.ping || 45;
  const serverIp = selectedServer?.ip || '165.22.95.14';
  const serverName = selectedServer?.name || 'Default Singapore Gateway';

  // State for history array (holding last 60 points = 5 minutes at 5s intervals)
  const [history, setHistory] = useState<PingDataPoint[]>([]);

  // Pre-generate rolling 5-minute history on mount so the chart is instantly populated
  useEffect(() => {
    const points: PingDataPoint[] = [];
    const now = Date.now();
    
    // Profiles configuration
    const getBasePingAndJitter = (prof: ProfileType) => {
      let bp = serverBasePing;
      let jit = 5;
      if (prof === 'lte') { bp = serverBasePing + 25; jit = 15; }
      if (prof === 'satellite') { bp = serverBasePing + 450; jit = 60; }
      if (prof === 'congested') { bp = serverBasePing + 120; jit = 80; }
      return { bp, jit };
    };

    const { bp, jit } = getBasePingAndJitter(profile);

    // Populate 60 data points (representing the last 5 minutes at 5s intervals)
    for (let i = 59; i >= 0; i--) {
      const pointTime = new Date(now - i * 5000);
      const timeStr = pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Add random variation
      let jitterVal = (Math.random() - 0.4) * jit;
      // Add occasional spikes
      if (Math.random() > 0.95 && profile !== 'fiber') {
        jitterVal += Math.random() * 80 + 40;
      }
      
      let finalLat = Math.max(8, bp + jitterVal);
      if (optimizeActive) {
        finalLat = Math.max(6, finalLat * 0.85); // 15% optimization reduction
      }

      // 1% packet loss chance in normal state
      const isLost = Math.random() < (profile === 'congested' ? 0.08 : profile === 'satellite' ? 0.04 : 0.01);

      points.push({
        timeLabel: timeStr,
        latency: isLost ? 0 : Math.round(finalLat),
        isLost,
        seq: seqRef.current++
      });
    }

    setHistory(points);
    setPingConsoleLogs([
      `[SYSTEM] Ping monitor telemetry engine armed.`,
      `[SYSTEM] Tracking gateway node: ${serverName} (${serverIp})`,
      `[SYSTEM] Selected protocol transport: ${selectedProtocol}`,
      `[INFO] Pre-populated last 5 minutes of telemetry metrics. Monitoring active...`
    ]);
  }, [selectedServer, selectedProtocol]);

  // Effect to append live ping data points periodically
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const generateNextPoint = () => {
      // Calculate active metrics
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Determine base profile multipliers
      let base = serverBasePing;
      let jitterRange = 6;
      let lossChance = 0.01;

      if (profile === 'lte') {
        base = serverBasePing + 25;
        jitterRange = 18;
        lossChance = 0.02;
      } else if (profile === 'satellite') {
        base = serverBasePing + 480;
        jitterRange = 75;
        lossChance = 0.04;
      } else if (profile === 'congested') {
        base = serverBasePing + 130;
        jitterRange = 90;
        lossChance = 0.10;
      }

      if (optimizeActive) {
        base = base * 0.82; // 18% optimization
        jitterRange = jitterRange * 0.5; // halving jitter
        lossChance = Math.max(0, lossChance - 0.02);
      }

      // Add a slight variance
      let finalJitter = (Math.random() - 0.5) * jitterRange;
      
      // Trigger random congestion spikes occasionally
      if (Math.random() > 0.93) {
        finalJitter += (Math.random() * (profile === 'fiber' ? 15 : 120));
      }

      const isLost = isConnected ? (Math.random() < lossChance) : false;
      const calculatedPing = isLost ? 0 : Math.round(Math.max(6, base + finalJitter));
      const currentSeq = seqRef.current++;

      const newPoint: PingDataPoint = {
        timeLabel: nowStr,
        latency: calculatedPing,
        isLost,
        seq: currentSeq
      };

      setHistory((prev) => {
        // Roll over - keep last 60 points
        const next = [...prev, newPoint];
        if (next.length > 60) {
          return next.slice(next.length - 60);
        }
        return next;
      });

      // Append terminal output log line
      const cleanIp = serverIp;
      if (!isConnected) {
        setPingConsoleLogs((prev) => [
          ...prev,
          `[${nowStr}] ping ${cleanIp}: link paused (tunnel state: DISCONNECTED)`
        ]);
      } else if (isLost) {
        setPingConsoleLogs((prev) => [
          ...prev,
          `[${nowStr}] Request timeout for icmp_seq=${currentSeq}. Packet dropped by egress gateway.`
        ]);
      } else {
        setPingConsoleLogs((prev) => [
          ...prev,
          `64 bytes from ${cleanIp}: icmp_seq=${currentSeq} ttl=56 time=${calculatedPing.toFixed(1)} ms`
        ]);
      }
    };

    // Trigger every 5 seconds to represent exactly 5 minutes of logs across 60 points
    timer = setInterval(generateNextPoint, 5000);

    return () => clearInterval(timer);
  }, [isConnected, serverBasePing, serverIp, profile, optimizeActive]);

  // Scroll terminal logs to bottom when updated
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pingConsoleLogs]);

  // Handle immediate manual ping trigger
  const handleTriggerManualPing = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const currentSeq = seqRef.current++;
    
    let base = serverBasePing;
    if (optimizeActive) base *= 0.82;
    
    const jitterFactor = profile === 'fiber' ? 5 : profile === 'lte' ? 15 : profile === 'satellite' ? 60 : 100;
    const calculated = Math.round(Math.max(6, base + (Math.random() - 0.5) * jitterFactor));

    setPingConsoleLogs((prev) => [
      ...prev,
      `[DIAGNOSTIC PROBE] Direct ICMP payload handshake broadcasted to ${serverIp}...`,
      `64 bytes from ${serverIp}: manual_seq=${currentSeq} ttl=56 time=${calculated.toFixed(1)} ms [RTT DIRECT]`
    ]);

    // Insert manually triggered point to history
    const newPoint: PingDataPoint = {
      timeLabel: nowStr,
      latency: calculated,
      isLost: false,
      seq: currentSeq
    };

    setHistory((prev) => {
      const next = [...prev, newPoint];
      if (next.length > 60) return next.slice(next.length - 60);
      return next;
    });

    if (pushLog) {
      pushLog(`Manual ping probe completed: response from ${serverIp} in ${calculated}ms`, 'info');
    }
  };

  // Toggle Route optimization
  const handleToggleOptimize = () => {
    const nextState = !optimizeActive;
    setOptimizeActive(nextState);
    
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (nextState) {
      setPingConsoleLogs((prev) => [
        ...prev,
        `[${nowStr}] [OPTIMIZER] Initialized BGP Anycast routing path audit...`,
        `[${nowStr}] [OPTIMIZER] Re-mapped egress tunnel ports ➔ Stabilizing packet stream`,
        `[${nowStr}] [OPTIMIZER] Multi-path TCP (MPTCP) active. Core latency reduced by ~18%.`
      ]);
      if (pushLog) {
        pushLog(`Dynamic routing optimization enabled! Reducing latency jitter.`, 'success');
      }
    } else {
      setPingConsoleLogs((prev) => [
        ...prev,
        `[${nowStr}] [OPTIMIZER] Standard routing paths restored.`
      ]);
    }
  };

  // Clean calculations based on history
  const activePoints = history.filter(p => !p.isLost);
  const minPing = activePoints.length > 0 ? Math.min(...activePoints.map(p => p.latency)) : 0;
  const maxPing = activePoints.length > 0 ? Math.max(...activePoints.map(p => p.latency)) : 0;
  const avgPing = activePoints.length > 0 
    ? Math.round(activePoints.reduce((acc, p) => acc + p.latency, 0) / activePoints.length) 
    : 0;

  // Calculate Jitter (average difference between consecutive pings)
  let calculatedJitter = 0;
  if (activePoints.length > 1) {
    let sumDiff = 0;
    for (let i = 1; i < activePoints.length; i++) {
      sumDiff += Math.abs(activePoints[i].latency - activePoints[i - 1].latency);
    }
    calculatedJitter = Math.round(sumDiff / (activePoints.length - 1));
  }

  // Calculate packet loss percentage
  const totalInWindow = history.length;
  const lostInWindow = history.filter(p => p.isLost).length;
  const lossPercentage = totalInWindow > 0 ? Math.round((lostInWindow / totalInWindow) * 100) : 0;

  // Render SVG Line Path
  const getSvgPathData = () => {
    if (history.length === 0) return { linePath: '', areaPath: '', xCoordinates: [] };
    const width = 500;
    const height = 150;
    const paddingLeft = 35;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const scaleX = chartWidth / (history.length - 1);
    
    // Find absolute max in history to keep axis clean, fallback to 100
    const highestVal = Math.max(...history.map(p => p.latency)) || 100;
    const maxAxisVal = highestVal < 100 ? 100 : highestVal < 250 ? 250 : highestVal < 600 ? 600 : 1000;

    const points = history.map((p, i) => {
      const x = paddingLeft + i * scaleX;
      // Handle lost packets cleanly on chart (render as baseline or skip, let's render as 0 latency / baseline to show dropout)
      const valueToDraw = p.isLost ? 0 : p.latency;
      // Invert Y axis
      const y = paddingTop + chartHeight - (valueToDraw / maxAxisVal) * chartHeight;
      return { x, y };
    });

    const linePathStr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
    const areaPathStr = `M ${points[0].x},${paddingTop + chartHeight} ` +
                        points.map(p => `L ${p.x},${p.y}`).join(' ') +
                        ` L ${points[points.length - 1].x},${paddingTop + chartHeight} Z`;

    return {
      linePath: linePathStr,
      areaPath: areaPathStr,
      maxAxisVal,
      chartHeight,
      chartWidth,
      paddingLeft,
      paddingTop,
      points
    };
  };

  const chartData = getSvgPathData();

  const getStatusColor = (val: number) => {
    if (val === 0) return 'text-slate-400';
    if (val < 45) return 'text-emerald-500';
    if (val < 100) return 'text-blue-500';
    if (val < 200) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getStatusBgColor = (val: number) => {
    if (val === 0) return 'bg-slate-100 text-slate-500';
    if (val < 45) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (val < 100) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (val < 200) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-700 border-rose-100';
  };

  const getStatusLabel = (val: number) => {
    if (val === 0) return 'DISCONNECTED';
    if (val < 45) return 'EXCELLENT';
    if (val < 100) return 'GOOD';
    if (val < 200) return 'MODERATE';
    return 'HIGH LATENCY';
  };

  const currentPingValue = history.length > 0 ? history[history.length - 1].latency : 0;
  const isLastLost = history.length > 0 ? history[history.length - 1].isLost : false;

  return (
    <div className="space-y-5 animate-fade-in text-slate-800">
      
      {/* 1. Header Information Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
            Ping Monitor & Jitter Telemetry
          </h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            Continuous diagnostic telemetry tracking network routing jitter and connection stability over the last 5 minutes.
          </p>
        </div>
        
        {/* Connection Lock Indicator */}
        {isConnected ? (
          <span className="flex items-center gap-1.5 self-start md:self-auto bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            TELEMETRY ACTIVE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 self-start md:self-auto bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5" />
            TUNNEL OFFLINE
          </span>
        )}
      </div>

      {/* 2. Interactive Network Profile & Optimization Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
        
        {/* Profile Selector */}
        <div className="md:col-span-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono mr-1">
            Network Profile:
          </span>
          <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 border border-slate-300/40">
            {(['fiber', 'lte', 'satellite', 'congested'] as ProfileType[]).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase cursor-pointer ${
                  profile === p 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Optimizations & Manual Ping */}
        <div className="md:col-span-6 flex items-center justify-end gap-2.5 w-full md:w-auto">
          {/* Optimization Toggle */}
          <button
            onClick={handleToggleOptimize}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
              optimizeActive 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <TrendingDown className={`w-3.5 h-3.5 ${optimizeActive ? 'animate-bounce' : ''}`} />
            {optimizeActive ? 'Route Optimized (18%)' : 'Optimize Routing'}
          </button>

          {/* Force Probe Button */}
          <button
            onClick={handleTriggerManualPing}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Manual Probe
          </button>
        </div>

      </div>

      {/* 3. Telemetry Key Metrics Display Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Metric 1: Current Ping */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Current Ping</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-mono font-black ${isLastLost ? 'text-rose-500 animate-pulse' : getStatusColor(currentPingValue)}`}>
              {isLastLost ? 'TIMEOUT' : `${currentPingValue}ms`}
            </span>
          </div>
          <span className={`mt-1.5 self-start text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${isLastLost ? 'bg-rose-50 text-rose-700 border-rose-100' : getStatusBgColor(currentPingValue)}`}>
            {isLastLost ? 'PACKET DROP' : getStatusLabel(currentPingValue)}
          </span>
        </div>

        {/* Metric 2: Min Ping */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Minimum Latency</span>
          <div className="mt-1">
            <span className="text-xl font-mono font-black text-slate-700">{minPing}ms</span>
          </div>
          <span className="mt-1.5 text-[8px] text-slate-400 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-300" /> Best case tunnel routing
          </span>
        </div>

        {/* Metric 3: Max Ping */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Maximum Latency</span>
          <div className="mt-1">
            <span className="text-xl font-mono font-black text-slate-700">{maxPing}ms</span>
          </div>
          <span className="mt-1.5 text-[8px] text-slate-400 font-semibold flex items-center gap-1">
            <Sliders className="w-3 h-3 text-slate-300" /> Peak buffer congestion
          </span>
        </div>

        {/* Metric 4: Average Jitter */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Network Jitter</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-mono font-black ${calculatedJitter > 25 ? 'text-amber-600' : 'text-slate-700'}`}>
              ±{calculatedJitter}ms
            </span>
          </div>
          <span className="mt-1.5 text-[8px] text-slate-400 font-semibold flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-300" /> Route deviation index
          </span>
        </div>

        {/* Metric 5: Packet Loss */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">Packet Loss (5m)</span>
          <div className="mt-1">
            <span className={`text-xl font-mono font-black ${lossPercentage > 2 ? 'text-rose-500 font-extrabold' : 'text-slate-700'}`}>
              {lossPercentage}%
            </span>
          </div>
          <span className={`mt-1.5 self-start text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
            lossPercentage > 2 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            {lossPercentage > 2 ? 'UNSTABLE LINK' : 'STABLE STREAM'}
          </span>
        </div>

      </div>

      {/* 4. Telemetry Line Chart Stage */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-xl">
        
        {/* Ambient Dark Gradients */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mt-32 -ml-16"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mb-32 -mr-16"></div>

        {/* Chart Header */}
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
              Real-Time RTT Trace (5 Minutes Window)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-indigo-500"></span> PING LATENCY
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-rose-500"></span> PACKET LOSS
            </span>
          </div>
        </div>

        {/* SVG Render Core */}
        <div className="relative h-44 w-full">
          {history.length > 0 ? (
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 500 150" 
              preserveAspectRatio="none"
              onMouseLeave={() => {
                setHoveredPoint(null);
                setHoveredIndex(null);
              }}
            >
              {/* Gradients */}
              <defs>
                <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              {(() => {
                const gridVals = [0.25, 0.5, 0.75, 1];
                return gridVals.map((val, idx) => {
                  const y = chartData.paddingTop + chartData.chartHeight * (1 - val);
                  const label = Math.round(chartData.maxAxisVal * val);
                  return (
                    <g key={idx}>
                      <line 
                        x1={chartData.paddingLeft} 
                        y1={y} 
                        x2={500 - 10} 
                        y2={y} 
                        stroke="#1e293b" 
                        strokeDasharray="2 3" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={chartData.paddingLeft - 6} 
                        y={y + 3} 
                        fill="#475569" 
                        fontSize="8" 
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {label}ms
                      </text>
                    </g>
                  );
                });
              })()}

              {/* Chart Gradient Area */}
              <path d={chartData.areaPath} fill="url(#latencyGrad)" />

              {/* Chart Line */}
              <path 
                d={chartData.linePath} 
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Interaction Circles & Packet Drops */}
              {chartData.points.map((pt, idx) => {
                const item = history[idx];
                const isLost = item.isLost;
                
                return (
                  <g key={idx}>
                    {/* Lost Packets indicated with a vertical red notch */}
                    {isLost ? (
                      <line 
                        x1={pt.x} 
                        y1={chartData.paddingTop} 
                        x2={pt.x} 
                        y2={chartData.paddingTop + chartData.chartHeight} 
                        stroke="#ef4444" 
                        strokeWidth="1.5" 
                        strokeOpacity="0.4"
                      />
                    ) : null}

                    {/* Circle indicators on hover or selected points */}
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r={hoveredIndex === idx ? 5 : isLost ? 3.5 : 1}
                      fill={isLost ? '#ef4444' : hoveredIndex === idx ? '#38bdf8' : '#818cf8'} 
                      stroke={hoveredIndex === idx ? '#ffffff' : 'none'}
                      strokeWidth="1.5"
                      className="transition-all duration-100 cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredPoint(item);
                        setHoveredIndex(idx);
                      }}
                    />

                    {/* Invisble broad interactive hitbars for easier mouse hovering */}
                    <rect 
                      x={pt.x - 4} 
                      y={chartData.paddingTop} 
                      width={8} 
                      height={chartData.chartHeight} 
                      fill="transparent" 
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredPoint(item);
                        setHoveredIndex(idx);
                      }}
                    />
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-slate-600">
              Initializing telemetry stream logs...
            </div>
          )}

          {/* Precision Interactive Tooltip Overlay */}
          {hoveredPoint && hoveredIndex !== null && (
            <div 
              className="absolute bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg shadow-2xl z-20 font-mono text-[9px] text-slate-300 pointer-events-none space-y-1 select-none"
              style={{
                left: `${Math.min(360, Math.max(10, (hoveredIndex / 59) * 100 - 10))}%`,
                top: hoveredPoint.isLost ? '20px' : '45px'
              }}
            >
              <div className="flex justify-between gap-4 text-[8px] text-slate-500 border-b border-slate-800 pb-0.5 uppercase font-bold">
                <span>Seq {hoveredPoint.seq}</span>
                <span>{hoveredPoint.timeLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-slate-400 font-medium">RTT Rsp:</span>
                {hoveredPoint.isLost ? (
                  <span className="text-rose-500 font-black uppercase">Dropped (Timeout)</span>
                ) : (
                  <span className="text-emerald-400 font-black">{hoveredPoint.latency} ms</span>
                )}
              </div>
              {!hoveredPoint.isLost && (
                <div className="text-[8px] text-slate-500">
                  Variance: {(hoveredPoint.latency - serverBasePing) >= 0 ? '+' : ''}{(hoveredPoint.latency - serverBasePing).toFixed(0)}ms from baseline
                </div>
              )}
            </div>
          )}

        </div>

        {/* X Axis Timeline Labels */}
        <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-2 border-t border-slate-900 pt-2 px-8">
          <span>5 Minutes Ago</span>
          <span>2.5 Minutes Ago</span>
          <span>Active Telemetry Core (Now)</span>
        </div>

      </div>

      {/* 5. Diagnostics Live Console Shell */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-[10px] leading-relaxed text-slate-400">
        
        {/* Console Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Terminal className="w-3.5 h-3.5 text-indigo-500" />
            <span>EGRESS HOST ICMP PING TERMINAL OUTPUT</span>
          </div>
          <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {profile.toUpperCase()} // PORT: {selectedProtocol === 'SSH' ? '22' : '443'}
          </span>
        </div>

        {/* Live Logs Block */}
        <div className="h-[120px] overflow-y-auto space-y-1 scrollbar-thin">
          {pingConsoleLogs.map((log, idx) => {
            let color = 'text-slate-300';
            if (log.includes('Request timeout')) color = 'text-rose-500 font-semibold';
            else if (log.includes('[SYSTEM]')) color = 'text-indigo-400 font-bold';
            else if (log.includes('[INFO]')) color = 'text-sky-400';
            else if (log.includes('[OPTIMIZER]')) color = 'text-emerald-400';
            else if (log.includes('[DIAGNOSTIC PROBE]')) color = 'text-amber-400 font-bold';
            else if (log.includes('ping')) color = 'text-slate-500';

            return (
              <div key={idx} className={color}>
                {log}
              </div>
            );
          })}
          <div ref={consoleEndRef} />
        </div>

      </div>

    </div>
  );
}
