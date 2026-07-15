import React, { useState } from 'react';
import { Activity, Lock, Mail, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Auth({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg('');

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        onLoginSuccess(data.token);
      } else {
        throw new Error('Authentication succeeded but did not return a session token.');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 transition-colors duration-200">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg animate-pulse-slow">
            <Activity className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            {isSignUp ? 'Create your Account' : 'Sign in to Dashboard'}
          </h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            {isSignUp 
              ? 'Start tracking your endpoints and monitoring uptime 24/7.' 
              : 'Provide credentials to load keep-alive schedules and telemetry stats.'}
          </p>
        </div>

        {/* Auth Box */}
        <div className="card-panel p-8 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Message banner */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors shadow"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Register Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle login/signup link */}
          <div className="mt-6 text-center border-t border-slate-200 dark:border-slate-700 pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Create one"}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
