import { EventEmitter } from 'events';
import { getTargets, addLog, getAllActiveSelfPings } from './storage.js';

class PingEngine extends EventEmitter {
  constructor() {
    super();
    this.timers = new Map(); // targetId -> setInterval instance
    this.selfPingTimers = new Map(); // url -> setInterval instance
  }

  // Start pinging all active targets
  async startAll() {
    console.log('Starting Ping Engine...');
    
    // Fetch targets for all users
    const targets = await getTargets();
    for (const target of targets) {
      if (target.active) {
        this.startTarget(target);
      }
    }

    // Start self pinging for all users who enabled it
    try {
      const selfPings = await getAllActiveSelfPings();
      const uniqueUrls = [...new Set(selfPings)];
      for (const url of uniqueUrls) {
        this.startSelfPing(url);
      }
    } catch (err) {
      console.error('Error starting self-pings on boot:', err.message);
    }
  }

  // Stop all active timers
  stopAll() {
    console.log('Stopping Ping Engine...');
    for (const [id, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    for (const [url, timer] of this.selfPingTimers.entries()) {
      clearInterval(timer);
      this.selfPingTimers.delete(url);
    }
  }

  // Start a single target
  startTarget(target) {
    // Clear existing timer if any
    this.stopTarget(target.id);

    console.log(`Scheduling ping for target: ${target.name} (${target.url}) every ${target.interval}s`);

    // Run the first ping immediately after a tiny delay, then run at intervals
    setTimeout(() => this.pingTarget(target), 1000);

    const timer = setInterval(() => {
      this.pingTarget(target);
    }, target.interval * 1000);

    this.timers.set(target.id, timer);
  }

  // Stop a single target
  stopTarget(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
      console.log(`Stopped pinging target ID: ${id}`);
    }
  }

  // Restart a target (used when updated or toggled on)
  restartTarget(target) {
    this.stopTarget(target.id);
    if (target.active) {
      this.startTarget(target);
    }
  }

  // Start self pinging (typically runs every 10 minutes to stay awake)
  startSelfPing(url) {
    if (this.selfPingTimers.has(url)) {
      return; // Already scheduled
    }
    
    console.log(`Scheduling self-ping to ${url} every 10 minutes`);
    
    // First ping in 10 seconds
    setTimeout(() => this.pingSelf(url), 10000);

    // Render sleeps after 15 mins, so 10 mins (600s) is safe to keep it awake
    const timer = setInterval(() => {
      this.pingSelf(url);
    }, 10 * 60 * 1000);

    this.selfPingTimers.set(url, timer);
  }

  stopSelfPing(url) {
    if (this.selfPingTimers.has(url)) {
      clearInterval(this.selfPingTimers.get(url));
      this.selfPingTimers.delete(url);
      console.log(`Stopped self-pinging: ${url}`);
    }
  }

  // Perform self-ping (doesn't write full logs to db to prevent cluttering, just simple print / emit)
  async pingSelf(url) {
    try {
      console.log(`[Self-Ping] Keeping myself awake at ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const start = Date.now();
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Render-Pinger/1.0 (Self-Wake)' }
      });
      clearTimeout(timeoutId);
      
      const latency = Date.now() - start;
      console.log(`[Self-Ping] Success: Code ${res.status} (${latency}ms)`);
      
      this.emit('self-ping', {
        url,
        status: 'success',
        statusCode: res.status,
        responseTime: latency,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[Self-Ping] Failed: ${err.message}`);
      this.emit('self-ping', {
        url,
        status: 'failed',
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Perform target ping
  async pingTarget(target) {
    const { id, name, url, userId } = target;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const startTime = Date.now();
    let logData = {
      targetId: id,
      targetName: name,
      userId: userId, // Scopes the log to the correct user in Supabase
      url: url,
      status: 'failed',
      statusCode: null,
      responseTime: 0,
      errorMessage: null
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Render-Pinger/1.0 (Keep-Alive Service)',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      logData.responseTime = Date.now() - startTime;
      logData.statusCode = response.status;
      
      if (response.ok) {
        logData.status = 'success';
      } else {
        logData.status = 'failed';
        logData.errorMessage = `HTTP error! Status: ${response.status}`;
      }
    } catch (error) {
      logData.responseTime = Date.now() - startTime;
      logData.status = 'failed';
      if (error.name === 'AbortError') {
        logData.errorMessage = 'Request timed out (10s limit)';
      } else {
        logData.errorMessage = error.message;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Write to DB
    try {
      const dbLog = await addLog(logData);
      // Emit event for real-time streaming
      this.emit('ping', dbLog);
    } catch (err) {
      console.error('Failed to log ping result:', err);
    }
  }
}

const pinger = new PingEngine();
export default pinger;
