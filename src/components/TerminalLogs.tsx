import { useState, useEffect, useRef } from 'react';
import { TerminalLog } from '../types';
import {
  Terminal,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Pause,
  Play,
  Activity,
  Sparkles,
  Wifi,
  FileText
} from 'lucide-react';

interface TerminalLogsProps {
  logs: TerminalLog[];
  onClear: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  onInjectLog?: (message: string, type: TerminalLog['type']) => void;
}

export default function TerminalLogs({
  logs,
  onClear,
  isConnected,
  isConnecting,
  onInjectLog
}: TerminalLogsProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<TerminalLog['type'] | 'all'>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [displayLogs, setDisplayLogs] = useState<TerminalLog[]>([]);

  // Local copy of logs that stops updating when paused
  useEffect(() => {
    if (!isPaused) {
      setDisplayLogs(logs);
    }
  }, [logs, isPaused]);

  // Auto-scroll when new logs arrive and stream is not paused
  useEffect(() => {
    if (!isPaused) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayLogs, isPaused]);

  const getLogColorClass = (type: TerminalLog['type']) => {
    switch (type) {
      case 'info':
        return 'text-slate-300';
      case 'debug':
        return 'text-cyan-400';
      case 'success':
        return 'text-emerald-400';
      case 'warning':
        return 'text-amber-400 font-medium';
      case 'error':
        return 'text-rose-400 font-semibold';
      default:
        return 'text-slate-300';
    }
  };

  const getBadgeIcon = () => {
    if (isConnected) {
      return (
        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded animate-pulse">
          <ShieldCheck className="w-3 h-3" /> SECURED
        </span>
      );
    }
    if (isConnecting) {
      return (
        <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded animate-pulse">
          HANDSHAKING
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
        <ShieldAlert className="w-3 h-3" /> BYPASSED
      </span>
    );
  };

  // Filter & search logs
  const filteredLogs = displayLogs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || log.type === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  // Export logs to txt file for troubleshooting
  const handleExportLogs = () => {
    try {
      const logString = filteredLogs
        .map((log) => `[${log.timestamp}] [OpenTunnel] [${log.type.toUpperCase()}] ${log.message}`)
        .join('\r\n');
      const blob = new Blob([logString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gln_tunnel_troubleshoot_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  // Perform custom log injection diagnostics demo
  const handleRunDiagnosticsDemo = () => {
    if (!onInjectLog) return;
    
    onInjectLog('[DIAGNOSTICS] Starting Local MTU and Route optimization run...', 'info');
    
    setTimeout(() => {
      onInjectLog('[PROBE] Testing MTU Packet Fragment payload: Size = 1500 bytes', 'debug');
    }, 400);

    setTimeout(() => {
      onInjectLog('[PROBE] Fragmented packet OK: MSS size adjusted to 1460 bytes', 'success');
    }, 850);

    setTimeout(() => {
      onInjectLog('[ROUTER] Hop-by-Hop ping test to DNS interface 1.1.1.1: 14ms reply', 'debug');
    }, 1300);

    setTimeout(() => {
      onInjectLog('[TUNNEL] Cryptographic vector integrity check: VERIFIED (ChaCha20)', 'success');
    }, 1800);

    setTimeout(() => {
      onInjectLog('[DIAGNOSTICS] Run complete. All tunnel virtual routes operating at Peak Efficiency.', 'success');
    }, 2200);
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg flex flex-col h-[350px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 gap-2">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-xs text-slate-200 font-bold">Diagnostics & Syslog Console</span>
          </div>
          <div className="md:hidden">
            {getBadgeIcon()}
          </div>
        </div>

        {/* Console Controls */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              isPaused
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={isPaused ? 'Resume stream updates' : 'Pause stream updates'}
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3" /> PAUSED
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" /> STREAMING
              </>
            )}
          </button>

          {/* Diagnostics Inject */}
          {onInjectLog && (
            <button
              onClick={handleRunDiagnosticsDemo}
              className="flex items-center gap-1 font-mono font-bold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Inject demo diagnostic packet steps"
            >
              <Activity className="w-3 h-3" /> TRACE ROUTE
            </button>
          )}

          {/* Export log */}
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1 font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-0.5 rounded transition-colors cursor-pointer"
            title="Download active filter logs as a .txt file for troubleshooting"
          >
            <Download className="w-3 h-3" /> EXPORT .TXT
          </button>

          {/* Clear logs */}
          <button
            id="btn-clear-logs"
            onClick={onClear}
            className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="hidden md:block">
            {getBadgeIcon()}
          </div>
        </div>
      </div>

      {/* Toolbar (Search & Filter) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 py-1.5 bg-slate-900/60 border-b border-slate-800 gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm flex items-center">
          <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search log triggers..."
            className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 rounded px-2 py-1 pl-7 text-slate-300 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Severity Filter pills */}
        <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono font-bold">
          <span className="text-slate-500 mr-1 flex items-center gap-0.5">
            <Filter className="w-2.5 h-2.5" /> Severity:
          </span>
          {(['all', 'info', 'debug', 'success', 'warning', 'error'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer uppercase ${
                selectedSeverity === sev
                  ? sev === 'all'
                    ? 'bg-blue-600 text-white'
                    : sev === 'info'
                    ? 'bg-slate-400 text-black'
                    : sev === 'debug'
                    ? 'bg-cyan-500 text-black'
                    : sev === 'success'
                    ? 'bg-emerald-500 text-black'
                    : sev === 'warning'
                    ? 'bg-amber-500 text-black'
                    : 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Lines scroll container */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1 bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-12">
            {searchTerm || selectedSeverity !== 'all' ? (
              <span>No logs found matching active filters. Try resetting terms.</span>
            ) : (
              <span>Console quiet. Toggle connection or adjust configuration to see diagnostic logging.</span>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/30 px-1 py-0.5 rounded">
              <span className="text-slate-600 select-none text-[10px] shrink-0 pt-0.5">{log.timestamp}</span>
              <span className="text-emerald-600 select-none shrink-0 font-bold">[gln tunnel]</span>
              <span className={`break-all ${getLogColorClass(log.type)}`}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
