import React, { useMemo } from 'react';
import { Activity, Clock, Server, CheckCircle, AlertTriangle } from 'lucide-react';

export default function Dashboard({ targets, logs }) {
  // Stats calculations
  const stats = useMemo(() => {
    const totalTargets = targets.length;
    const activeTargets = targets.filter(t => t.active).length;
    
    const successfulPings = logs.filter(l => l.status === 'success');
    const totalPings = logs.length;
    const uptime = totalPings > 0 
      ? Math.round((successfulPings.length / totalPings) * 100) 
      : 100;
      
    const avgLatency = successfulPings.length > 0
      ? Math.round(successfulPings.reduce((sum, l) => sum + l.responseTime, 0) / successfulPings.length)
      : 0;

    return {
      totalTargets,
      activeTargets,
      uptime,
      avgLatency,
      totalPings
    };
  }, [targets, logs]);

  // Generate path data for the SVG Latency Chart
  const chartData = useMemo(() => {
    const recentLogs = [...logs].slice(0, 15).reverse();
    if (recentLogs.length < 2) return null;

    const width = 600;
    const height = 150;
    const padding = 20;

    const latencies = recentLogs.map(l => l.responseTime);
    const maxLat = Math.max(...latencies, 200); // minimum scale limit 200ms
    const minLat = 0;
    const range = maxLat - minLat;

    const points = recentLogs.map((log, index) => {
      const x = padding + (index / (recentLogs.length - 1)) * (width - padding * 2);
      const y = height - padding - ((log.responseTime - minLat) / range) * (height - padding * 2);
      return { x, y, val: log.responseTime, label: log.targetName, status: log.status, time: new Date(log.timestamp).toLocaleTimeString() };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { points, pathD, areaD, width, height, padding, maxLat };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric: Uptime */}
        <div className="card-panel p-5 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Uptime Rate</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
                {stats.uptime}%
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Calculated from {stats.totalPings} requests
          </p>
        </div>

        {/* Metric: Avg Latency */}
        <div className="card-panel p-5 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Latency</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
                {stats.avgLatency} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">ms</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Response round-trip speed
          </p>
        </div>

        {/* Metric: Active Targets */}
        <div className="card-panel p-5 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Monitoring</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono tracking-tight">
                {stats.activeTargets} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ {stats.totalTargets}</span>
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Configured endpoints active
          </p>
        </div>

        {/* Metric: Engine Status */}
        <div className="card-panel p-5 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Engine State</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
                {stats.activeTargets > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-bold">ACTIVE</span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-2xl font-bold">IDLE</span>
                )}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            {stats.activeTargets > 0 ? 'Pinging scheduled queues' : 'No active ping targets'}
          </p>
        </div>
      </div>

      {/* Latency History Chart Card */}
      <div className="card-panel p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h4 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Latency Response Chart
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Telemetry showing latency for the last 15 checks</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded bg-indigo-600" />
              Latency (ms)
            </span>
          </div>
        </div>

        {chartData ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              className="w-full h-auto min-w-[500px]"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                const y = chartData.padding + ratio * (chartData.height - chartData.padding * 2);
                const val = Math.round(chartData.maxLat - ratio * chartData.maxLat);
                return (
                  <g key={index} className="opacity-40">
                    <line
                      x1={chartData.padding}
                      y1={y}
                      x2={chartData.width - chartData.padding}
                      y2={y}
                      stroke="#94a3b8"
                      strokeWidth="0.75"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={chartData.padding - 6}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area Fill */}
              <path d={chartData.areaD} fill="url(#chartGradient)" />

              {/* Connected Line */}
              <path
                d={chartData.pathD}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
              />

              {/* Data Points */}
              {chartData.points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill={pt.status === 'success' ? '#4f46e5' : '#ef4444'}
                    className="cursor-pointer hover:r-5 transition-all duration-150"
                  />
                  <title>
                    {`${pt.label}\nTime: ${pt.time}\nLatency: ${pt.val}ms\nStatus: ${pt.status}`}
                  </title>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="h-[150px] flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500">
            <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium">Awaiting ping events...</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">Logs must populate to display Y-axis telemetry.</p>
          </div>
        )}
      </div>
    </div>
  );
}
