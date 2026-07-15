# Render Pinger SaaS 📡

Render Pinger is a 24/7 keep-alive scheduler and telemetry dashboard built using **React.js**, **Express.js**, **Tailwind CSS**, and **Supabase**. It is designed to keep free-tier deployed applications (such as those hosted on Render, Fly.io, Koyeb, etc.) active 24/7 and prevent them from sleeping due to inactivity.

This version is a **multi-user SaaS application**—users can register their own accounts, securely manage their private endpoints, and view their own latency telemetry charts.

---

## Features

- **Multi-User Authentication**: Register accounts and sign in securely, powered by Supabase Auth.
- **SaaS Telemetry Dashboard**: Clean, modern slate-themed dashboard displaying key metrics (Uptime Rate, Latency Average, Online Targets).
- **Interactive SVG Latency Chart**: Custom line graph displaying the round-trip response speed of the last 15 checks.
- **Tabular Live Logs Feed**: Monospace styled activity table displaying the timestamp, endpoint name, URL, response status, and latency of outgoing pings in real-time.
- **Supabase PostgreSQL Database**: Persistent storage for targets, settings, and logs. Includes automated background log pruning to maintain quick queries.
- **Automated Self-Ping Keep-Alive**: Toggle loop that automatically requests its own server domain to reset Render's 15-minute inactivity timer.

---

## Monorepo Structure

```text
├── backend/
│   ├── .env.example     # Environment template variables
│   ├── server.js        # Express API routing and SSE client streams
│   ├── pinger.js        # Outgoing ping scheduler loops
│   └── storage.js       # Supabase database query adapter
├── frontend/
│   ├── src/             # Vite + React Client Source code
│   │   ├── components/  # Dashboard, target manager, logs, auth cards
│   │   ├── index.css    # Typography, slate theme styling configurations
│   │   └── App.jsx      # Navigation, SSE stream connections, request auth
│   ├── index.html       # Web client root html
│   └── vite.config.js   # Vite config with Tailwind CSS & Proxy
├── package.json         # Root monorepo scripts config
└── README.md
```

---

## Database Initialization (Supabase Setup)

You do **not** need to install anything on your system. You only need to provision a free online database on [Supabase](https://supabase.com/).

### 1. Execute SQL Migration
Create your project on Supabase, navigate to the **SQL Editor** > **Blank Query**, paste the following script, and click **Run**:

```sql
-- Create targets table
CREATE TABLE targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create logs table with cascading deletes
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
  target_name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings table
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY,
  self_ping_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  self_ping_url TEXT DEFAULT '',
  max_logs_count INTEGER DEFAULT 200
);
```

### 2. Copy API credentials
Navigate to your **Project Settings** > **API**:
*   **Project URL**: e.g., `https://your-project-id.supabase.co`
*   **service_role Key**: Copy the secret key (labeled `service_role` which bypasses RLS and allows backend database operations).

---

## Local Development Setup

### 1. Install Dependencies
Install all package packages in both frontend and backend using the root script:
```bash
npm run install:all
```

### 2. Configure Local Environment
Create a `.env` file inside the `backend/` directory (`backend/.env`) and insert your credentials:
```text
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

### 3. Build & Run
Compile the frontend client and run the server:
```bash
npm run build:frontend
npm start
```
Open `http://localhost:5000` in your browser.

---

## Deploying to Render (Single Service)

You can host this entire project on Render using **only one Free Web Service instance** since the Express server serves both the API and the compiled React assets.

1. **Create Web Service**: Click **New +** > **Web Service** on Render and link your GitHub repository.
2. **Language**: Select `Node`.
3. **Build Command**: Set to compile the monorepo workspace:
   ```bash
   npm run build:all
   ```
4. **Start Command**: Set to execute the server:
   ```bash
   npm start
   ```
5. **Environment Variables**: Add your Supabase credentials:
   - `SUPABASE_URL`: `https://your-project-id.supabase.co`
   - `SUPABASE_KEY`: `your-supabase-service-role-key`

---

## Keeping the Pinger Awake 24/7 (Self-Ping)

Render's free tier sleeps any web service after **15 minutes of inactivity**. Even though the pinger scheduler runs in the background, Render will still spin down the instance unless it receives inbound HTTP traffic.

*   **How to solve**: Go to the **Settings** tab on your live dashboard, toggle **Enable self-pings** to **ON**, and save settings.
*   The backend will automatically start sending a request to itself every 10 minutes to reset Render's inactivity timer.
*   **Self-Ping URL Resolution**: The backend will automatically detect its URL using Render's environment variable `RENDER_EXTERNAL_URL`. If this is not set, it defaults to a hardcoded fallback (`https://render-pinger-knpi.onrender.com/`).
