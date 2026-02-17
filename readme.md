RustSploit GUI — Full-Stack Implementation Plan
A separate web application that provides a premium dark hacker-aesthetic GUI to control the rustsploit framework through its existing API.

Architecture
REST + JWT
Proxy + Bearer Token
React SPAVite + TailwindCSS:5173
GUI BackendExpress.js + SQLite:4000
RustSploit APIExisting Rust/Axum:8080
Frontend: React 18 + TypeScript + Vite + TailwindCSS (dark mode)
Backend: Express.js + TypeScript, handles user auth, ACL, proxies to rustsploit API
Database: SQLite (via better-sqlite3) — no extra server needed
Auth: GUI backend issues JWTs after local login → proxies to rustsploit with stored API key
User Review Required
IMPORTANT

The GUI backend stores the rustsploit API key in its config (env var RSF_API_KEY). Individual GUI users authenticate against the GUI backend with their own credentials + optional TOTP. The backend forwards requests to rustsploit using the shared API key.

IMPORTANT

The existing rustsploit gui/ directory (with space) will be used as-is.

Proposed Changes
Backend — Express.js Server
All backend files go in rustsploit gui/backend/.

[NEW] 
package.json
Node.js project with dependencies: express, better-sqlite3, bcryptjs, jsonwebtoken, otplib, qrcode, cors, uuid, helmet, http-proxy-middleware.

[NEW] 
tsconfig.json
TypeScript config targeting ES2020, strict mode.

[NEW] 
src/database.ts
SQLite setup. Tables:

users: id, username, email, password_hash, role (sysadmin|admin|pentester), totp_secret, totp_enabled, acl_template_id, custom_acl_json, created_at, updated_at
acl_templates: id, name, permissions_json, created_at
Seeds default sysadmin: admin / RustSploit2024!
[NEW] 
src/password.ts
Min 12 chars, uppercase, lowercase, digit, special char
bcrypt hashing (12 rounds)
[NEW] 
src/middleware.ts
authenticateJWT — verify JWT from Authorization header
requireRole(role) — role-based gate
requirePermission(permission) — ACL-based gate
[NEW] 
src/routes/auth.ts
Route	Description
POST /api/auth/login	Username+password, returns JWT (or TOTP challenge)
POST /api/auth/verify-totp	Verify TOTP code, returns final JWT
POST /api/auth/logout	Invalidate session
GET /api/auth/me	Current user info
[NEW] 
src/routes/users.ts
Admin/sysadmin user CRUD: list, create, update (role, ACL), delete.

[NEW] 
src/routes/settings.ts
Self-service: change password (complexity enforced), TOTP setup (QR), verify & enable, disable.

[NEW] 
src/routes/acl.ts
Sysadmin ACL template CRUD.

[NEW] 
src/routes/proxy.ts
Proxies /api/rsf/* to the rustsploit API, adding Authorization: Bearer <api_key>. ACL checks before forwarding.

[NEW] 
src/server.ts
Express entry point. CORS, helmet, JSON parsing, routes, port 4000.

Frontend — React SPA
All frontend files go in rustsploit gui/frontend/.

[NEW] Vite React-TS project
Initialized with npm create vite@latest ./ -- --template react-ts

[NEW] 
tailwind.config.js
Dark mode with cyberpunk color palette (neon green #00ff41, dark backgrounds).

[NEW] 
src/stores/authStore.ts
Zustand store: user, token, permissions, login/logout actions.

[NEW] 
src/lib/apiClient.ts
Axios instance with JWT interceptor, auto-redirect on 401.

[NEW] 
src/components/Layout.tsx
Dark theme layout, collapsible sidebar, glassmorphism cards, user info header.

[NEW] 
src/pages/LoginPage.tsx
Cyberpunk login with animated terminal effect, TOTP modal step.

[NEW] 
src/pages/DashboardPage.tsx
Main dashboard. Panels rendered based on user ACL:

Module Browser, Module Runner, Jobs, Target, Status
Users (admin+), ACL (sysadmin)
[NEW] 
src/pages/SettingsPage.tsx
Password change with live complexity indicator, TOTP setup with QR code.

[NEW] 
src/components/ModuleBrowser.tsx
Tree view of exploits/scanners/creds. Search bar.

[NEW] 
src/components/ModuleRunner.tsx
Dynamic form for module params. Execute button, job tracking.

[NEW] 
src/components/OutputConsole.tsx
Terminal-style output with syntax highlighting, auto-polling.

[NEW] 
src/components/JobsPanel.tsx
Table of jobs with status, duration, output links.

[NEW] 
src/components/UserManagement.tsx
Admin panel: user table, create/edit/delete, assign roles and ACL templates.

[NEW] 
src/components/ACLManager.tsx
Sysadmin panel: create/edit ACL templates, define permissions.

ACL Permission Model
json
{
  "panels": {
    "modules": { "view": true, "run": true },
    "jobs": { "view": true },
    "target": { "view": true, "set": true },
    "status": { "view": true },
    "users": { "view": false, "manage": false },
    "acl": { "view": false, "manage": false },
    "settings": { "view": true }
  }
}
Role	Access
sysadmin	All permissions + ACL template management
admin	User management + all operational panels
pentester	Modules, jobs, target (configurable via ACL template)
Per-user custom_acl_json overrides template when set.

Verification Plan
Automated Tests
Backend compile: cd "rustsploit gui/backend" && npx tsc --noEmit
Frontend build: cd "rustsploit gui/frontend" && npm run build
Browser Verification
Start backend: cd "rustsploit gui/backend" && npm run dev (port 4000)
Start frontend: cd "rustsploit gui/frontend" && npm run dev (port 5173)
Navigate to http://localhost:5173 → verify dark-themed login page renders
Login with admin / RustSploit2024! → verify dashboard loads
Navigate to Settings → verify password change form with complexity rules
Navigate to Users panel → verify user management table
Test ACL: create pentester user, log in, verify restricted panels hidden
Manual Verification (User)
Configure RSF_API_KEY env var and start the rustsploit API server
Test module browsing, target setting, and job execution against the live
