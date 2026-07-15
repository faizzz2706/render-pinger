import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Play, Pause, ExternalLink, RefreshCw, X, Check } from 'lucide-react';

export default function PingerManager({ targets, onAdd, onUpdate, onDelete, onToggle }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form States
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setIntervalVal] = useState('60');

  // Edit States
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editInterval, setEditInterval] = useState('60');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url) return;
    
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      formattedUrl = 'https://' + url;
    }

    onAdd({
      name: name || new URL(formattedUrl).hostname || 'Unnamed Route',
      url: formattedUrl,
      interval: parseInt(interval, 10) || 60,
      active: true
    });

    setName('');
    setUrl('');
    setIntervalVal('60');
    setIsAdding(false);
  };

  const startEdit = (target) => {
    setEditingId(target.id);
    setEditName(target.name);
    setEditUrl(target.url);
    setEditInterval(target.interval.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdateSubmit = (id) => {
    if (!editUrl) return;
    
    let formattedUrl = editUrl;
    if (!/^https?:\/\//i.test(editUrl)) {
      formattedUrl = 'https://' + editUrl;
    }

    onUpdate(id, {
      name: editName,
      url: formattedUrl,
      interval: parseInt(editInterval, 10) || 60
    });

    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Monitored Endpoints</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define external routes to schedule automated keep-alive triggers.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm shadow"
          >
            <Plus className="w-4 h-4" />
            Add Target
          </button>
        )}
      </div>

      {/* Add New Target Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="card-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">New Target Endpoint</h4>
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Friendly Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Application"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Target URL</label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="app.onrender.com"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ping Interval</label>
              <select
                value={interval}
                onChange={e => setIntervalVal(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="10">Every 10 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
                <option value="600">Every 10 minutes</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow"
            >
              Save Target
            </button>
          </div>
        </form>
      )}

      {/* Targets List */}
      {targets.length === 0 ? (
        <div className="card-panel p-10 rounded-xl text-center text-slate-400 dark:text-slate-500">
          <RefreshCw className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3 animate-spin" style={{ animationDuration: '6s' }} />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No Endpoints Configured</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "Add Target" to add your first deployed service URL to the ping scheduler.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => {
            const isEditing = editingId === target.id;
            
            return (
              <div 
                key={target.id}
                className={`card-panel p-4 rounded-xl transition-all ${
                  target.active ? '' : 'opacity-60 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                {isEditing ? (
                  /* Editing Form */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Friendly Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Target URL</label>
                        <input
                          type="text"
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Ping Interval</label>
                        <select
                          value={editInterval}
                          onChange={e => setEditInterval(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="10">10s</option>
                          <option value="30">30s</option>
                          <option value="60">60s (1m)</option>
                          <option value="300">300s (5m)</option>
                          <option value="600">600s (10m)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateSubmit(target.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded transition-colors"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display details */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Active Status play/pause indicator */}
                      <button
                        onClick={() => onToggle(target.id)}
                        title={target.active ? 'Pause monitoring' : 'Resume monitoring'}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors active:scale-95 ${
                          target.active
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        {target.active ? (
                          <Play className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-400 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Pause className="w-3.5 h-3.5 fill-slate-400 text-slate-400" />
                        )}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{target.name}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Every {target.interval}s
                          </span>
                        </div>
                        <a 
                          href={target.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          {target.url}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(target)}
                        className="p-2 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Target"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(target.id)}
                        className="p-2 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-200 dark:hover:border-rose-800 rounded-lg transition-colors"
                        title="Delete Target"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
