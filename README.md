# Render Pinger 📡

Render Pinger is a 24/7 keep-alive utility and telemetry dashboard built using **React.js**, **Express.js**, and **Tailwind CSS v4**. It is designed to keep free-tier deployed applications (such as those hosted on Render, Fly.io, Koyeb, etc.) active 24/7 and prevent them from sleeping due to inactivity.

---

## Features

- **Telemetry Dashboard**: Beautiful dark-themed dashboard styled with glassmorphic cards and cyberpunk neon highlights.
- **Custom Latency Chart**: Interactive, real-time SVG response time line graph of recent pings.
- **Real-Time Log Stream**: Scrolling retro terminal displaying outgoing pings and response statuses in real-time, utilizing **Server-Sent Events (SSE)**.
- **Persistent Storage**: Targets and settings are persisted locally in a lightweight JSON database file (`backend/data/db.json`), ensuring configs survive server restarts.
- **Keep-Alive Configuration**: Includes built-in self-preservation pinging and circular ping setup guides.

---

## Monorepo Project Structure

```text
├── backend/
│   ├── data/db.json     # Persistent database
│   ├── server.js        # Express API and SSE Server
│   ├── pinger.js        # Pinging Scheduler Engine
│   └── storage.js       # JSON Storage Helper
├── frontend/
│   ├── src/             # Vite + React Client Source
│   ├── index.html       # Web client root html
│   └── vite.config.js   # Vite configuration with Tailwind CSS v4 & Proxy
├── package.json         # Root monorepo scripts config
└── README.md
```

---

## Local Quickstart

### 1. Install Dependencies
Run from the project root:
```bash
npm run install:all
```

### 2. Build the Frontend React client
```bash
npm run build:frontend
```

### 3. Run the Express Backend Server
```bash
npm start
```
The server will start on port `5000`. In production mode, it serves the React frontend statically from `frontend/dist`. Access the application at `http://localhost:5000`.

### 4. Development Mode (Hot Reloading)
To run backend and frontend separately during development:
- Backend: `npm run dev:backend` (Starts Express at `http://localhost:5000`)
- Frontend: `npm run dev:frontend` (Starts Vite Dev Server at `http://localhost:5173`)
Vite is preconfigured to proxy API requests from `/api` to `http://localhost:5000`.

---

## Deploying to Render (As a Single Service)

You can host this entire project on Render using **only one Free Web Service instance** since the Express server serves both the API and the compiled React assets.

1. **Create Web Service**: In your Render Dashboard, click **New +** > **Web Service** and connect your GitHub repository.
2. **Runtime**: Select `Node`.
3. **Build Command**: Set to compile the project root:
   ```bash
   npm run build:all
   ```
4. **Start Command**: Set to start the Express server:
   ```bash
   npm start
   ```
5. **Environment Variables**:
   - `PORT`: Set to standard (Render will inject this automatically, e.g. `10000`).

---

## Keeping the Pinger (and Targets) Awake 24/7 ⏰

Render's free tier spins down web services after **15 minutes of inactivity**. While Node's internal `setInterval` runs the pinging loop, **Render still sleeps the service unless it receives incoming HTTP requests.**

Here are the standard solutions to keep your services active 24/7:

### Strategy 1: Circular Pinging 🔄
If you are using this Pinger to keep another main Render app awake:
1. In the Pinger UI, add your **Main App URL** as a ping target (e.g. every 60 seconds).
2. Inside your main app's codebase, add a simple `fetch()` task to hit the Pinger's backend endpoint (e.g. `/api/targets`) every 5–10 minutes.
*Because both apps receive inbound HTTP requests from each other, neither will ever go to sleep!*

### Strategy 2: Free External Cron Trigger ⚡
If you only have one Render Web Service:
1. Register for a free account at [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
2. Create a new cron job that issues a `GET` request to your Pinger's URL (e.g., `https://your-pinger.onrender.com`) **once every 10–12 minutes**.
3. In the Pinger dashboard settings, enable **Self-Preservation keep-alive pings** and input your Pinger URL.
*The external cron job keeps the Pinger active, and the Pinger's scheduling engine keeps all other registered targets active.*
