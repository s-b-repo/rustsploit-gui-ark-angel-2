# 🛡️ RustSploit GUI

A premium dark-themed web GUI for the RustSploit penetration testing framework. Built with React + Vite (frontend) and Express.js + SQLite (backend).

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Default Credentials](#default-credentials)
- [Environment Variables](#environment-variables)
- [Project Structure & Where to Edit](#project-structure--where-to-edit)
- [API Routing & Proxy](#api-routing--proxy)
- [Troubleshooting](#troubleshooting)
- [ACL Permission Model](#acl-permission-model)

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   React SPA (Vite)  │────▶│  Express.js Backend │────▶│  RustSploit API     │
│   Port 5173         │     │  Port 4000          │     │  Port 9000          │
│   TailwindCSS v4    │     │  SQLite + JWT Auth  │     │  Rust/Axum          │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

- **Frontend** → Vite dev server on `:5173`, proxies `/api/*` to the backend
- **Backend** → Express on `:4000`, handles auth/users/ACL, proxies `/api/rsf/*` to RustSploit API
- **RustSploit API** → The actual Rust framework on `:9000`

---

## Prerequisites

- **Node.js** ≥ 18 (tested with v22)
- **npm** ≥ 9
- **RustSploit API** running on port 9000 (for module/job features)

---

## Installation

```bash
# 1. Clone the repo (if not already done)
git clone <repo-url>
cd "rustsploit gui"

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
```

If `npm install` fails with native module errors (e.g., `better-sqlite3`), try:
```bash
cd backend
npm rebuild better-sqlite3
```

---

## Running the Application

### Development Mode

Open **two terminals**:

```bash
# Terminal 1 — Backend (port 4000)
cd "rustsploit gui/backend"
npm run dev

# Terminal 2 — Frontend (port 5173)
cd "rustsploit gui/frontend"
npm run dev -- --host    # --host exposes to LAN
```

Then open **http://localhost:5173** in your browser.

### Production Build

```bash
cd "rustsploit gui/frontend"
npm run build              # Outputs to dist/

cd "../backend"
npm run build              # Compiles TS → dist/
npm run start              # Runs compiled backend
```

### With Nginx Proxy (optional)

If you have Nginx configured via `nginx.conf`:
```bash
./start_proxy.sh
```

---

## Default Credentials

| Username | Password           | Role     |
|----------|--------------------|----------|
| `admin`  | `RustSploit2024!`  | sysadmin |

> Change this immediately after first login via **Settings → Change Password**.

---

## Environment Variables

Create a `.env` file in `backend/`:

```env
PORT=4000                          # Backend port (default: 4000)
RSF_API_URL=http://127.0.0.1:9000  # RustSploit API address
RSF_API_KEY=your-api-key-here      # RustSploit API key
JWT_SECRET=change-me-to-random     # JWT signing secret
```

If no `.env` exists, the backend reads defaults from `src/server.ts`.

---

## Project Structure & Where to Edit

### Frontend (`frontend/src/`)

| Path | Purpose | When to Edit |
|------|---------|--------------|
| `index.css` | **Global CSS** — all utility classes (`.card-header`, `.stat-card`, `.table-premium`, `.btn-glow`, etc.) | Adding new design tokens, animations, or component styles |
| `main.tsx` | React entry point, router setup | Adding new routes |
| `App.tsx` | Route definitions (`/`, `/settings`, `/login`) | Adding new pages |
| **Pages** | | |
| `pages/LoginPage.tsx` | Login + TOTP verification | Auth flow changes |
| `pages/DashboardPage.tsx` | Main dashboard: stats, tabs, panels | Dashboard layout or tab changes |
| `pages/SettingsPage.tsx` | Password change, TOTP, API key config | Settings features |
| **Components** | | |
| `components/Layout.tsx` | Sidebar + header shell | Navigation items, sidebar styling |
| `components/ModuleBrowser.tsx` | Module tree view + search | Module listing/filtering |
| `components/ModuleDetail.tsx` | Selected module info display | Module info layout |
| `components/ModuleRunner.tsx` | Module execution form | Adding module parameter fields |
| `components/OutputConsole.tsx` | Job output terminal | Output formatting |
| `components/JobsPanel.tsx` | Running/completed jobs table | Job management features |
| `components/TargetPanel.tsx` | Target IP setting + honeypot check | Target-related features |
| `components/StatusPanel.tsx` | RSF status, config, logs, tracked IPs | Status monitoring |
| `components/ReportsPanel.tsx` | Job history, stats, export | Reporting features |
| `components/UserManagement.tsx` | User CRUD (admin+) | User management |
| `components/ACLManager.tsx` | ACL template CRUD (sysadmin) | Permission management |
| **State** | | |
| `stores/authStore.ts` | Zustand auth state (user, token) | Auth logic changes |
| `stores/rsfHealthStore.ts` | RSF connectivity tracking | Health check logic |
| **HTTP** | | |
| `lib/apiClient.ts` | Axios instance (baseURL: `/api`) | API interceptors, error handling |

### Backend (`backend/src/`)

| Path | Purpose | When to Edit |
|------|---------|--------------|
| `server.ts` | Express entry point, port config | Adding middleware, changing port |
| `database.ts` | SQLite schema, seed data | Schema changes, new tables |
| `middleware.ts` | JWT auth, role/permission guards | Auth logic, new middleware |
| `password.ts` | Password complexity rules, bcrypt | Password policy changes |
| `routes/auth.ts` | Login, TOTP verify, `/api/auth/*` | Auth endpoints |
| `routes/users.ts` | User CRUD, `/api/admin/users/*` | User management endpoints |
| `routes/acl.ts` | ACL templates, `/api/admin/acl-templates/*` | Permission system |
| `routes/settings.ts` | Password change, TOTP setup, API key | Settings endpoints |
| `routes/proxy.ts` | Proxies `/api/rsf/*` → RustSploit API | Adding new proxy routes |

### Config Files

| File | Purpose |
|------|---------|
| `frontend/vite.config.ts` | Dev server port, `/api` proxy to backend |
| `frontend/tsconfig.json` | TypeScript config for frontend |
| `backend/tsconfig.json` | TypeScript config for backend |
| `nginx.conf` | Nginx reverse proxy config (optional) |

---

## API Routing & Proxy

Understanding the request flow is critical to avoid bugs:

```
Browser Request          Vite Proxy          Backend Route         RustSploit API
──────────────────  ──────────────────  ──────────────────────  ──────────────────
/api/auth/login     → localhost:4000    → routes/auth.ts        (local)
/api/admin/users    → localhost:4000    → routes/users.ts       (local)
/api/rsf/modules    → localhost:4000    → routes/proxy.ts       → :9000/api/modules
/api/rsf/jobs       → localhost:4000    → routes/proxy.ts       → :9000/api/jobs
/api/settings/*     → localhost:4000    → routes/settings.ts    (local)
```

### ⚠️ Important: `apiClient` baseURL

The frontend's `apiClient.ts` has `baseURL: '/api'`. This means:

```typescript
// ✅ CORRECT — paths in components should NOT include /api
apiClient.get('/rsf/modules')      // → /api/rsf/modules
apiClient.get('/admin/users')      // → /api/admin/users
apiClient.get('/auth/login')       // → /api/auth/login

// ❌ WRONG — this creates /api/api/... (double prefix!)
apiClient.get('/api/rsf/modules')  // → /api/api/rsf/modules  (404!)
apiClient.get('/api/admin/users')  // → /api/api/admin/users  (404!)
```

---

## Troubleshooting

### 🔴 "Module not found" on Dashboard

**Cause**: API calls returning 404 because the RSF API isn't running or the endpoint path has a double `/api` prefix.

**Fix**:
1. Make sure the RustSploit Rust API is running on port 9000
2. Check that component API calls don't include `/api` prefix (the `apiClient` adds it automatically)
3. Verify the backend is running: `curl http://localhost:4000/api/auth/me`

### 🔴 `EADDRINUSE: address already in use :::4000` (or `:5173`)

**Cause**: A previous server process didn't shut down cleanly.

**Fix**:
```bash
# Kill processes on specific ports
fuser -k 4000/tcp 5173/tcp

# Or kill all related processes
pkill -f 'tsx watch|vite'

# Then restart
npm run dev
```

### 🔴 Frontend shows blank page or login redirect loop

**Cause**: Backend is down, or JWT token expired.

**Fix**:
1. Check backend is running on port 4000
2. Clear browser `localStorage` (DevTools → Application → Local Storage → Clear)
3. Refresh and log in again

### 🔴 "Cannot use JSX" lint errors in IDE

**Cause**: IDE TypeScript server doesn't pick up Vite's JSX config. This is a **cosmetic IDE issue only** — Vite/esbuild handles JSX fine.

**Fix** (optional): Add to `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### 🔴 `better-sqlite3` native module errors

**Cause**: Native addon compiled for a different Node.js version.

**Fix**:
```bash
cd backend
npm rebuild better-sqlite3
# or
rm -rf node_modules && npm install
```

### 🔴 RSF API shows "disconnected" in Status panel

**Cause**: RustSploit Rust API isn't running, or wrong API key.

**Fix**:
1. Start the Rust API: `cd /path/to/rustsploit && cargo run`
2. Check `RSF_API_KEY` in `backend/.env` matches the key in the Rust API config
3. Verify manually: `curl -H "Authorization: Bearer YOUR_KEY" http://127.0.0.1:9000/api/status`

### 🔴 TOTP setup QR code doesn't load

**Cause**: `qrcode` npm package issue.

**Fix**:
```bash
cd backend
npm install qrcode@latest
```

### 🔴 Changes to CSS not showing

**Cause**: Browser cache or Vite HMR glitch.

**Fix**:
1. Hard refresh: `Ctrl+Shift+R`
2. If that doesn't work, restart the Vite dev server

---

## ACL Permission Model

```json
{
  "panels": {
    "modules": { "view": true, "run": true },
    "jobs":    { "view": true },
    "target":  { "view": true, "set": true },
    "status":  { "view": true },
    "users":   { "view": false, "manage": false },
    "acl":     { "view": false, "manage": false },
    "settings": { "view": true }
  }
}
```

| Role | Access |
|------|--------|
| **sysadmin** | All permissions + ACL template management |
| **admin** | User management + all operational panels |
| **pentester** | Modules, jobs, target (configurable via ACL template) |

Per-user `custom_acl_json` overrides the template when set.

---

## License

See [LICENSE](./LICENSE) for details.
