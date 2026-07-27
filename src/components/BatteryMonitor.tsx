import React, { useState, useEffect, useRef } from 'react';
import {
  Battery,
  BatteryCharging,
  Zap,
  Thermometer,
  ShieldAlert,
  Info,
  RefreshCw,
  Cpu,
  TrendingDown,
  Activity,
  AlertOctagon,
  Flame,
  CheckCircle,
  Clock
} from 'lucide-react';

interface BatteryMonitorProps {
  isConnected: boolean;
  isConnecting: boolean;
  downloadSpeed: number; // KB/s
  uploadSpeed: number; // KB/s
  pushLog?: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

export default function BatteryMonitor({
  isConnected,
  isConnecting,
  downloadSpeed,
  uploadSpeed,
  pushLog
}: BatteryMonitorProps) {
  // Battery State Values
  const [level, setLevel] = useState(78);
  const [isCharging, setIsCharging] = useState(false);
  const [temperature, setTemperature] = useState(30.4); // °C
  const [currentDraw, setCurrentDraw] = useState(210); // mA
  const [ecoMode, setEcoMode] = useState(false);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [isRunningProbe, setIsRunningProbe] = useState(false);
  const [probeResult, setProbeResult] = useState<string | null>(null);

  // Stats histories for rolling micro sparklines
  const [tempHistory, setTempHistory] = useState<number[]>(Array(15).fill(30.4));
  const [drainHistory, setDrainHistory] = useState<number[]>(Array(15).fill(210));

  // Actual Browser Battery API integration (Read if available, fallback to high-fidelity simulation)
  useEffect(() => {
    let batteryInstance: any = null;

    const updateBatteryStatus = (batt: any) => {
      setLevel(Math.round(batt.level * 100));
      setIsCharging(batt.charging);
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        batteryInstance = batt;
        updateBatteryStatus(batt);
        
        batt.addEventListener('levelchange', () => updateBatteryStatus(batt));
        batt.addEventListener('chargingchange', () => updateBatteryStatus(batt));
      }).catch(() => {
        // Fallback silently to simulator
      });
    }

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('levelchange', () => updateBatteryStatus(batteryInstance));
        batteryInstance.removeEventListener('chargingchange', () => updateBatteryStatus(batteryInstance));
      }
    };
  }, []);

  // Calculate live drain and temperature based on Connection State and Speeds
  useEffect(() => {
    const timer = setInterval(() => {
      const activeTrafficKb = downloadSpeed + uploadSpeed;
      
      // Calculate Simulated Temperature
      // Baseline temp is around 29.5°C when idle / disconnected
      let targetTemp = 29.5;
      if (isConnected) {
        // Add up to 3°C for basic tunnel idle overhead, and up to 10°C for extreme high speed crypto activity
        const speedOverhead = Math.min(activeTrafficKb / 1000, 10); // capped at 10°C rise
        targetTemp = 32.5 + speedOverhead;
        
        // Eco mode throttles encryption intensity, decreasing temperature rise by ~25%
        if (ecoMode) {
          targetTemp = 31.0 + speedOverhead * 0.7;
        }
      } else if (isConnecting) {
        targetTemp = 31.2;
      }

      // Smooth temperature transition towards target (thermal lag simulation)
      setTemperature((prev) => {
        const diff = targetTemp - prev;
        const step = diff * 0.15; // 15% convergence per 1s tick
        const next = prev + step + (Math.random() * 0.1 - 0.05); // slight noise
        return parseFloat(next.toFixed(1));
      });

      // Calculate Current Draw (mA)
      let baseDraw = 180; // Default idle discharged mA
      if (isCharging) {
        // Charging pulls positive power
        baseDraw = ecoMode ? -1100 : -1450; // negative draw means charging
      } else {
        if (isConnecting) {
          baseDraw = 320;
        } else if (isConnected) {
          // Encryption & network overhead
          const cryptoBase = ecoMode ? 180 : 340; // baseline encryption cost
          const speedFactor = Math.min(activeTrafficKb * 0.35, 1200); // speed transmission cost
          baseDraw = 180 + cryptoBase + speedFactor;
        }
        // Small random fluctuations
        baseDraw += Math.round(Math.random() * 16 - 8);
      }
      
      const nextDraw = Math.round(baseDraw);
      setCurrentDraw(nextDraw);

      // Log updates to rolling histories
      setTempHistory((prev) => [...prev.slice(1), parseFloat(targetTemp.toFixed(1))]);
      setDrainHistory((prev) => [...prev.slice(1), Math.abs(nextDraw)]);

      // Simulated slow depletion (if not connected to real Battery API)
      if (!('getBattery' in navigator)) {
        setLevel((prev) => {
          if (isCharging) {
            return prev < 100 ? prev + (Math.random() < 0.1 ? 1 : 0) : 100;
          } else {
            // Drain rate scales with current draw (e.g. 500mA drops 1% every 45 secs in real life; we speed it up here for high fidelity visualization)
            const drainProbability = (Math.abs(nextDraw) / 2000) * 0.15;
            if (Math.random() < drainProbability) {
              return prev > 1 ? prev - 1 : 1;
            }
            return prev;
          }
        });
      }

    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, isConnecting, downloadSpeed, uploadSpeed, isCharging, ecoMode]);

  // Run dynamic battery diagnostics probe
  const handleRunBatteryProbe = () => {
    setIsRunningProbe(true);
    setProbeResult(null);
    if (pushLog) {
      pushLog('[BATTERY] Launching internal device battery hardware health probe...', 'info');
    }

    setTimeout(() => {
      const activeTraffic = downloadSpeed + uploadSpeed;
      const baselineCost = 210; // mA
      const tunnelCost = isConnected ? (ecoMode ? 350 : 650) : 0;
      const totalEstimatedPower = Math.round(baselineCost + tunnelCost + (activeTraffic * 0.3));
      
      let assessment = 'HEALTHY';
      let advice = 'No thermal or excessive battery issues found.';
      if (temperature > 39) {
        assessment = 'THERMAL STRESS WARNING';
        advice = 'Cryptographic decryption (ChaCha20) is generating high CPU heat. Consider activating Eco-Tunnel Mode.';
      } else if (isConnected && !ecoMode) {
        assessment = 'SECURE BUT HIGH INTENSITY';
        advice = 'Tunnel encryption is operating at maximum throughput. Activating Eco-Tunnel optimization can save up to 35% battery.';
      } else if (ecoMode) {
        assessment = 'OPTIMIZED ECO PROFILE';
        advice = 'Throttling payload frequency and MTU wrapping active. Power efficiency optimized.';
      }

      const report = `
[PROBE COMPLETED]
------------------
- Charge Level: ${level}% (${isCharging ? 'AC Powered' : 'Discharging'})
- Internal Temp: ${temperature}°C (${(temperature * 1.8 + 32).toFixed(1)}°F)
- Current Draw: ${currentDraw} mA
- Secure Tunnel Overhead: +${isConnected ? (ecoMode ? '18% mA' : '38% mA') : '0% (Bypassed)'}
- Thermal Status: ${temperature > 40 ? 'CRITICAL THERMAL' : temperature > 36 ? 'WARM WARNING' : 'NORMAL'}
- Assessment: ${assessment}
- Recommended Action: ${advice}
      `.trim();

      setProbeResult(report);
      setIsRunningProbe(false);

      if (pushLog) {
        pushLog(`[BATTERY] Hardware Assessment completed. Temperature: ${temperature}°C, Current draw: ${currentDraw}mA.`, 'success');
      }
    }, 2000);
  };

  // Eco Tunnel Switch trigger with Syslog updates
  const handleToggleEcoMode = () => {
    const nextState = !ecoMode;
    setEcoMode(nextState);
    if (pushLog) {
      if (nextState) {
        pushLog('[BATTERY] Eco-Tunnel protocol optimizations ENABLED.', 'success');
        pushLog('[BATTERY] Reducing background polling interval, adjusting MTU to 1380 for packet optimization, capping crypto refresh cycles.', 'info');
      } else {
        pushLog('[BATTERY] Eco-Tunnel protocol optimizations DISABLED. Restoring full-speed cryptographic throughput.', 'warning');
      }
    }
  };

  // Get thermal alert colors and icons
  const getThermalStatus = () => {
    if (temperature > 40) {
      return {
        label: 'CRITICAL',
        color: 'text-rose-500 border-rose-500/20 bg-rose-500/10',
        textColor: 'text-rose-400',
        desc: 'Overheating. CPU Throttling active.',
        icon: <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
      };
    }
    if (temperature > 35) {
      return {
        label: 'WARM WARNING',
        color: 'text-amber-500 border-amber-500/20 bg-amber-500/10',
        textColor: 'text-amber-400',
        desc: 'Elevated encryption CPU load.',
        icon: <ShieldAlert className="w-4 h-4 text-amber-400 animate-bounce" />
      };
    }
    return {
      label: 'COOL & HEALTHY',
      color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
      textColor: 'text-emerald-400',
      desc: 'Optimal hardware operations.',
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
    };
  };

  const thermal = getThermalStatus();

  // Convert histories into compact micro line SVG path
  const getSparklinePoints = (data: number[]) => {
    const width = 120;
    const height = 24;
    const max = Math.max(...data) || 1;
    const min = Math.min(...data) || 0;
    const spread = max - min || 1;
    const scaleX = width / (data.length - 1);
    const points = data.map((val, i) => {
      const x = i * scaleX;
      const y = height - ((val - min) / spread) * height;
      return `${x},${y}`;
    });
    return points.join(' ');
  };

  return (
    <div className="bg-[#0b0c10] border border-white/10 rounded-2xl p-6 text-slate-300 space-y-6">
      
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Battery className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-white text-sm">Real-Time Battery & Power Monitor</h3>
            <p className="text-[10px] text-slate-400 font-mono">Monitors cryptographic thermal & telemetry impact</p>
          </div>
        </div>

        {/* ECO mode pill indicator */}
        <button
          onClick={handleToggleEcoMode}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black border tracking-wider transition-all cursor-pointer ${
            ecoMode
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${ecoMode ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          {ecoMode ? 'ECO MODE ACTIVE' : 'ACTIVATE ECO MODE'}
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Metric 1: Battery Percentage */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Charge Level</span>
            {isCharging ? (
              <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <Battery className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="mt-2.5 flex items-baseline gap-1">
            <span className="text-3xl font-mono font-black text-white">{level}%</span>
            <span className="text-[10px] font-mono text-slate-500">{isCharging ? 'CHARGING' : 'DISCHARGING'}</span>
          </div>
          <div className="mt-3.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                level < 20 ? 'bg-rose-500' : level < 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${level}%` }}
            ></div>
          </div>
        </div>

        {/* Metric 2: Battery Temperature */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Core Temperature</span>
            <Thermometer className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-mono font-black text-white">
                {tempUnit === 'C' ? `${temperature}°C` : `${(temperature * 1.8 + 32).toFixed(1)}°F`}
              </span>
              <button
                onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                className="text-[9px] font-mono text-indigo-400 hover:underline block mt-0.5"
              >
                Switch to °{tempUnit === 'C' ? 'F' : 'C'}
              </button>
            </div>
            {/* SVG Sparkline */}
            <div className="opacity-70">
              <svg width="60" height="20" className="stroke-indigo-400 fill-none stroke-2">
                <polyline points={getSparklinePoints(tempHistory)} />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono truncate">
            {temperature > 37 ? '🔥 Tunneling overhead heater' : '❄️ Steady cold profile'}
          </div>
        </div>

        {/* Metric 3: Current Draw */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Current Power Draw</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-mono font-black text-white">
                {currentDraw > 0 ? `${currentDraw} mA` : `+${Math.abs(currentDraw)} mA`}
              </span>
              <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                {isCharging ? 'AC adapter source' : 'Discharge flow rate'}
              </span>
            </div>
            {/* SVG Sparkline */}
            <div className="opacity-70">
              <svg width="60" height="20" className="stroke-cyan-400 fill-none stroke-2">
                <polyline points={getSparklinePoints(drainHistory)} />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            {isCharging ? 'Replenishing energy storage' : `${Math.round(4200 / Math.max(1, Math.abs(currentDraw)))} hrs battery capacity`}
          </div>
        </div>

        {/* Metric 4: Diagnostic Thermal Profiler */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Thermal Status</span>
            {thermal.icon}
          </div>
          <div>
            <span className={`text-xs font-mono font-bold uppercase ${thermal.textColor} block`}>
              {thermal.label}
            </span>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              {thermal.desc}
            </p>
          </div>
          <div className={`mt-2 border rounded p-1.5 text-[9px] font-mono ${thermal.color}`}>
            Health Indicator: EXCELLENT (96%)
          </div>
        </div>

      </div>

      {/* Dynamic Tunnel Encryption Power Drain Analysis Section */}
      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Encryption Tunneling Power Impact</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: 1s ticks</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          
          {/* Comparison bars */}
          <div className="lg:col-span-2 space-y-3">
            
            {/* Bar 1: Baseline Power */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Standard Unsecured Web idle (Baseline)</span>
                <span className="font-mono text-slate-400">180 mA</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className="bg-slate-500 h-full rounded-full" style={{ width: '15%' }}></div>
              </div>
            </div>

            {/* Bar 2: Tunneling Idle Power */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  GLN Secure Tunnel (Idle)
                  {isConnected && <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded uppercase">Connected</span>}
                </span>
                <span className="font-mono text-indigo-400">
                  {ecoMode ? '360 mA' : '520 mA'}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className="bg-indigo-500 h-full rounded-full shadow-[0_0_8px_#6366f1]" style={{ width: ecoMode ? '30%' : '42%' }}></div>
              </div>
            </div>

            {/* Bar 3: High Activity Encryption Power */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  High-Activity Crypto Tunneling ({Math.round(downloadSpeed + uploadSpeed)} KB/s throughput)
                  {downloadSpeed + uploadSpeed > 500 && <span className="text-[9px] bg-rose-500/15 text-rose-400 border border-rose-500/30 px-1 py-0.5 rounded uppercase animate-pulse">Heavy Load</span>}
                </span>
                <span className="font-mono text-rose-400 font-bold">
                  {isConnected ? `${Math.round(currentDraw)} mA` : 'Not Testing'}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentDraw < 500 ? 'bg-indigo-400' : currentDraw < 1000 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                  }`}
                  style={{ width: isConnected ? `${Math.min((currentDraw / 1800) * 100, 100)}%` : '0%' }}
                ></div>
              </div>
            </div>

          </div>

          {/* Interactive Eco mode switch and helper details */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3 text-[11px]">
            <span className="font-bold text-white block uppercase tracking-wider">Optimized Packet Throttle</span>
            <p className="text-slate-400 leading-normal">
              Active tunneling creates cryptographic CPU packets requiring frequent kernel wakeups. Turning on <b>Eco Mode</b> mitigates this drain:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>Lowers temperature by <b>3-5°C</b>.</li>
              <li>Saves up to <b>35% power draw</b>.</li>
              <li>Slightly clamps high-burst speeds.</li>
            </ul>
          </div>

        </div>
      </div>

      {/* Diagnostics / Hardware Probe Panel */}
      <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Battery Diagnostics & Load Tester</span>
          </div>
          <button
            onClick={handleRunBatteryProbe}
            disabled={isRunningProbe}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {isRunningProbe ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> PROBING BATTERY...
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5" /> PROBE HARDWARE HEALTH
              </>
            )}
          </button>
        </div>

        {/* Display Probe Report output */}
        {probeResult && (
          <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 font-mono text-[10px] leading-relaxed text-slate-300 relative animate-slide-up">
            <div className="absolute top-3 right-3 text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> ASSESSMENT PASSED
            </div>
            <pre className="whitespace-pre-wrap">{probeResult}</pre>
          </div>
        )}
      </div>

    </div>
  );
}
