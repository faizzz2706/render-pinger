import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Settings as SettingsIcon, 
  Wifi, 
  WifiOff, 
  HelpCircle,
  PlayCircle,
  Link as LinkIcon,
  ShieldCheck,
  RefreshCw,
  LogOut
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import PingerManager from './components/PingerManager';
import LiveConsole from './components/LiveConsole';
import Auth from './components/Auth';

export default function App() {
  // Session Token State
  const [token, setToken] = useState(() => localStorage.getItem('pinger_auth_token') || '');

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'targets', 'settings'
  const [targets, setTargets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selfPings, setSelfPings] = useState([]);
  const [settings, setSettings] = useState({
    selfPingEnabled: false,
    selfPingUrl: '',
    maxLogsCount: 200
  });

  // UI Connection Status
  const [sseConnected, setSseConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Settings Temp Fields
  const [tempSelfPingEnabled, setTempSelfPingEnabled] = useState(false);
  const [tempSelfPingUrl, setTempSelfPingUrl] = useState('');

  // API Call helper with Authorization injection
  const apiFetch = async (url, options = {}) => {
    try {
      const headers = options.headers || {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      options.headers = headers;

      const res = await fetch(url, options);
      if (res.status === 401) {
        // Token expired or invalid: clear session and logout
        handleLogout();
        throw new Error('Session expired. Please sign in again.');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'API Request failed');
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${url}:`, err);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
      throw err;
    }
  };

  const handleLoginSuccess = (newToken) => {
    localStorage.setItem('pinger_auth_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('pinger_auth_token');
    setToken('');
    setTargets([]);
    setLogs([]);
    setSelfPings([]);
    setSseConnected(false);
  };

  // Fetch Initial Data on Token availability
  useEffect(() => {
    if (!token) return;

    const initData = async () => {
      setIsLoading(true);
      try {
        const [fetchedTargets, fetchedLogs, fetchedSettings] = await Promise.all([
          apiFetch('/api/targets'),
          apiFetch('/api/logs'),
          apiFetch('/api/settings')
        ]);
        setTargets(fetchedTargets || []);
        setLogs(fetchedLogs || []);
        const safeSettings = fetchedSettings || { selfPingEnabled: false, selfPingUrl: '', maxLogsCount: 200 };
        setSettings(safeSettings);
        setTempSelfPingEnabled(safeSettings.selfPingEnabled);
        setTempSelfPingUrl(safeSettings.selfPingUrl);
      } catch (err) {
        console.error('Failed to load startup data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [token]);

  // Set up SSE EventStream with query authorization token parameter
  useEffect(() => {
    if (!token) return;

    const streamUrl = `${window.location.origin}/api/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'ping') {
          setLogs(prevLogs => {
            const newLogs = [data, ...prevLogs];
            const maxLogs = settings?.maxLogsCount || 200;
            return newLogs.slice(0, maxLogs);
          });
        } else if (type === 'self-ping') {
          setSelfPings(prevSelf => {
            const newSelf = [data, ...prevSelf];
            return newSelf.slice(0, 50);
          });
        }
      } catch (err) {
        console.error('[SSE] Failed to parse stream message:', err);
      }
    };

    return () => {
      eventSource.close();
      setSseConnected(false);
    };
  }, [token, settings?.maxLogsCount]);

  // Target Actions
  const handleAddTarget = async (newTargetData) => {
    try {
      const added = await apiFetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTargetData)
      });
      setTargets(prev => [...prev, added]);
    } catch (err) {
      console.error('Add target failed:', err);
    }
  };

  const handleUpdateTarget = async (id, updatedData) => {
    try {
      const updated = await apiFetch(`/api/targets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      setTargets(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err) {
      console.error('Update target failed:', err);
    }
  };

  const handleDeleteTarget = async (id) => {
    try {
      await apiFetch(`/api/targets/${id}`, { method: 'DELETE' });
      setTargets(prev => prev.filter(t => t.id !== id));
      setLogs(prev => prev.filter(l => l.targetId !== id));
    } catch (err) {
      console.error('Delete target failed:', err);
    }
  };

  const handleToggleTarget = async (id) => {
    try {
      const toggled = await apiFetch(`/api/targets/${id}/toggle`, { method: 'POST' });
      setTargets(prev => prev.map(t => t.id === id ? toggled : t));
    } catch (err) {
      console.error('Toggle target failed:', err);
    }
  };

  // Log Actions
  const handleClearLogs = async () => {
    try {
      await apiFetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      setSelfPings([]);
    } catch (err) {
      console.error('Clear logs failed:', err);
    }
  };

  // Settings Actions
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const updatedSettings = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfPingEnabled: tempSelfPingEnabled,
          selfPingUrl: tempSelfPingUrl
        })
      });
      setSettings(updatedSettings);
      alert('Settings updated successfully!');
    } catch (err) {
      console.error('Save settings failed:', err);
    }
  };

  // Render Login Card if not authenticated
  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Navigation / Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Activity className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Pinger Dashboard
                <span className="text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Keep-alive manager and latency telemetry.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              sseConnected 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {sseConnected ? 'Connected' : 'Offline'}
            </span>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            Error: {errorMsg}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === 'dashboard'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('targets')}
            className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === 'targets'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Manage Endpoints
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Tab Contents */}
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading details...</p>
          </div>
        ) : (
          <main className="space-y-8">
            
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <>
                <Dashboard targets={targets} logs={logs} />
                <LiveConsole logs={logs} onClearLogs={handleClearLogs} selfPings={selfPings} />
              </>
            )}

            {/* Manage Endpoints Tab */}
            {activeTab === 'targets' && (
              <PingerManager
                targets={targets}
                onAdd={handleAddTarget}
                onUpdate={handleUpdateTarget}
                onDelete={handleDeleteTarget}
                onToggle={handleToggleTarget}
              />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Configuration Panel */}
                <div className="lg:col-span-2 card-panel p-6 rounded-xl space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Self-Ping Configuration
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Configure the server to request its own HTTP endpoints periodically to keep the instance active on platforms like Render.
                    </p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    {/* Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">Enable self-pings</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Executes a lightweight request to this app every 10 minutes.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={tempSelfPingEnabled} 
                          onChange={(e) => setTempSelfPingEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:bg-slate-400 peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {/* URL */}
                    {tempSelfPingEnabled && (
                      <div className="space-y-2">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Self Deployed URL</label>
                        <input
                          type="url"
                          value={tempSelfPingUrl}
                          onChange={(e) => setTempSelfPingUrl(e.target.value)}
                          placeholder="https://render-pinger.onrender.com"
                          required={tempSelfPingEnabled}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                          Provide the absolute https URL where this pinger application is running (e.g. Render site address).
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm shadow"
                      >
                        Save Settings
                      </button>
                    </div>
                  </form>
                </div>

                {/* Documentation / Info Card */}
                <div className="card-panel p-6 rounded-xl space-y-5">
                  <h4 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    How to Avoid Sleeping
                  </h4>
                  
                  <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400">
                    <div className="space-y-1">
                      <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                        <PlayCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        1. Inactivity Timeout
                      </span>
                      <p>
                        Render's free tier sleeps web services after 15 minutes of inactivity. Background loops alone do not block sleeping; only inbound requests keep it active.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        2. Circular Strategy
                      </span>
                      <p>
                        Pinger can ping your web app, and your web app can ping this Pinger. By creating this circular loop, both servers receive requests and remain online.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        3. External Cron Jobs
                      </span>
                      <p>
                        Register a free trigger on <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">cron-job.org</a> or <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">UptimeRobot</a> to ping this Pinger every 10 minutes.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
