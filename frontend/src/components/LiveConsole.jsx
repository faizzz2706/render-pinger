import React, { useState, useEffect, useRef } from 'react';
import { Table, Trash2, ShieldAlert, CheckCircle2, Eye, EyeOff, Radio } from 'lucide-react';

export default function LiveConsole({ logs, onClearLogs, selfPings }) {
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'failed', 'self'
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef(null);

  // Combine standard logs and self-pings, sorted by date (oldest to newest for chronological addition)
  const combinedLogs = React.useMemo(() => {
    const formattedLogs = logs.map(l => ({ ...l, isSelf: false }));
    const formattedSelf = selfPings.map(s => ({
      id: s.timestamp + s.url,
      targetName: 'Self-Wake Engine',
      url: s.url,
      status: s.status,
      statusCode: s.statusCode || null,
      responseTime: s.responseTime || 0,
      errorMessage: s.errorMessage || null,
      timestamp: s.timestamp,
      isSelf: true
    }));

    const all = [...formattedLogs, ...formattedSelf];
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return all;
  }, [logs, selfPings]);

  // Filtered Logs
  const filteredLogs = React.useMemo(() => {
    if (filter === 'all') return combinedLogs;
    if (filter === 'success') return combinedLogs.filter(l => l.status === 'success' && !l.isSelf);
    if (filter === 'failed') return combinedLogs.filter(l => l.status === 'failed' && !l.isSelf);
    if (filter === 'self') return combinedLogs.filter(l => l.isSelf);
    return combinedLogs;
  }, [combinedLogs, filter]);

  // Auto Scroll Effect
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  return (
    <div className="card-panel p-5 rounded-xl flex flex-col h-[420px]">
      
      {/* Telemetry Log Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Live Activity Log</h3>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Filter Segmented Controls */}
          <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-semibold shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-3 py-1 rounded-md transition-colors ${filter === 'success' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Success
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1 rounded-md transition-colors ${filter === 'failed' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-semibold shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Errors
            </button>
            <button
              onClick={() => setFilter('self')}
              className={`px-3 py-1 rounded-md transition-colors ${filter === 'self' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 font-semibold shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Self-Wake
            </button>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 border rounded-lg transition-colors flex items-center gap-1 ${
              autoScroll 
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' 
                : 'text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="Auto-scroll to bottom"
          >
            {autoScroll ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Auto Scroll
          </button>

          {/* Clear Database logs */}
          <button
            onClick={onClearLogs}
            className="p-1.5 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 text-slate-400 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-1"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Structured Logs Table */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-inner"
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 z-10 font-semibold">
            <tr>
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Endpoint</th>
              <th className="px-4 py-2.5">URL</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 italic">
                  No activities in log stream...
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                const isSuccess = log.status === 'success';
                const isSelf = log.isSelf;

                return (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelf ? 'bg-purple-50/20 dark:bg-purple-950/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-400 select-none whitespace-nowrap">{time}</td>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-700 dark:text-slate-300">
                      {isSelf ? (
                        <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          Self-Wake Loop
                        </span>
                      ) : (
                        log.targetName
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 truncate max-w-[150px] md:max-w-xs" title={log.url}>
                      {log.url}
                    </td>
                    <td className="px-4 py-2">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-medium text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
                          OK {log.statusCode && `(${log.statusCode})`}
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-sans font-medium text-[11px] cursor-help"
                          title={log.errorMessage || 'Unknown Error'}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 stroke-[2]" />
                          FAIL {log.statusCode && `(${log.statusCode})`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isSuccess ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{log.responseTime}ms</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
