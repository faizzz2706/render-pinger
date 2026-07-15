import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import {
  getTargets,
  addTarget,
  updateTarget,
  deleteTarget,
  getLogs,
  clearLogs,
  getSettings,
  updateSettings,
  supabase
} from './storage.js';
import pinger from './pinger.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve React Frontend static assets if in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Real-time Event Stream Clients (SSE)
let clients = [];

// Listen to pinger events and route to correct users
pinger.on('ping', (log) => {
  const payload = JSON.stringify({ type: 'ping', data: log });
  clients.forEach(client => {
    // Only broadcast the log to the owner of the target
    if (client.userId === log.userId) {
      client.res.write(`data: ${payload}\n\n`);
    }
  });
});

pinger.on('self-ping', async (log) => {
  const payload = JSON.stringify({ type: 'self-ping', data: log });
  // Route self-ping logs only to the user who configured this self-ping URL
  for (const client of clients) {
    try {
      const userSettings = await getSettings(client.userId);
      if (userSettings.selfPingEnabled && userSettings.selfPingUrl === log.url) {
        client.res.write(`data: ${payload}\n\n`);
      }
    } catch (err) {
      // Ignore settings fetch errors for SSE routing
    }
  }
});

// Authentication Middleware
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token session' });
    }

    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Authentication process failed' });
  }
};

// Auth Controllers
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Check if session is returned (e.g. if email confirmation is disabled)
    const token = data?.session?.access_token;
    res.status(201).json({
      message: 'Account successfully registered!',
      token: token || null,
      user: data.user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const token = data?.session?.access_token;
    res.json({
      token,
      user: data.user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SSE Route for real-time logs and stats (requires query token auth verification)
app.get('/api/stream', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Token query parameter missing' });
  }

  let userId;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token session' });
    }
    userId = user.id;
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token validation failed' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE stream connected' })}\n\n`);

  const clientId = Date.now();
  const newClient = { id: clientId, userId, res };
  clients.push(newClient);

  console.log(`[SSE] Client ${clientId} (User: ${userId}) connected. Total clients: ${clients.length}`);

  const heartbeatTimer = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    clients = clients.filter(client => client.id !== clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Total clients: ${clients.length}`);
    res.end();
  });
});

// REST API Routes (Protected)

// Targets Endpoints
app.get('/api/targets', requireAuth, async (req, res) => {
  try {
    const targets = await getTargets(req.userId);
    res.json(targets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/targets', requireAuth, async (req, res) => {
  try {
    const { url, name, interval, active } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const newTarget = await addTarget({ url, name, interval, active }, req.userId);
    
    // Start ping scheduler loop
    if (newTarget.active) {
      pinger.startTarget(newTarget);
    }
    
    res.status(201).json(newTarget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/targets/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTarget = await updateTarget(id, req.body, req.userId);
    if (!updatedTarget) {
      return res.status(404).json({ error: 'Target not found or unauthorized' });
    }
    
    pinger.restartTarget(updatedTarget);
    res.json(updatedTarget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/targets/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteTarget(id, req.userId);
    if (!success) {
      return res.status(404).json({ error: 'Target not found or unauthorized' });
    }
    
    pinger.stopTarget(id);
    res.json({ message: 'Target and associated logs deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/targets/:id/toggle', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const targets = await getTargets(req.userId);
    const target = targets.find(t => t.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    const updatedTarget = await updateTarget(id, { active: !target.active }, req.userId);
    pinger.restartTarget(updatedTarget);
    
    res.json(updatedTarget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs Endpoints
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const logs = await getLogs(req.userId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/logs', requireAuth, async (req, res) => {
  try {
    await clearLogs(req.userId);
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Endpoints
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings(req.userId);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const oldSettings = await getSettings(req.userId);
    const newSettings = await updateSettings(req.body, req.userId);
    
    // Handle user self-ping scheduling
    if (newSettings.selfPingEnabled && newSettings.selfPingUrl) {
      pinger.startSelfPing(newSettings.selfPingUrl);
    } else if (!newSettings.selfPingEnabled && oldSettings.selfPingEnabled) {
      // Only stop self-ping if no other user is actively pinging the same URL
      const activeSelfPings = await getTargets(); // fetch all targets
      const stillInUse = activeSelfPings.some(
        s => s.selfPingEnabled && s.selfPingUrl === oldSettings.selfPingUrl && s.userId !== req.userId
      );
      if (!stillInUse) {
        pinger.stopSelfPing(oldSettings.selfPingUrl);
      }
    }
    
    res.json(newSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Wildcard route to serve React's index.html in production
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Initialize Pinger Engine & Start Server
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await pinger.startAll();
  } catch (err) {
    console.error('Error starting Ping engine on boot:', err);
  }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server and stopping intervals.');
  pinger.stopAll();
  server.close(() => {
    console.log('HTTP server closed.');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server and stopping intervals.');
  pinger.stopAll();
  server.close(() => {
    console.log('HTTP server closed.');
  });
});
