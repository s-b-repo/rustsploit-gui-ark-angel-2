#!/usr/bin/env python3
"""
RustSploit GUI — Setup & Launch Tool
=====================================
Sets up the backend (Express + SQLite) and frontend (React + Vite),
generates environment config, installs dependencies, and optionally
launches both dev servers.

Usage:
    python3 setup.py              # Interactive setup
    python3 setup.py --install    # Install deps only
    python3 setup.py --start      # Start dev servers only
    python3 setup.py --status     # Check health of services
    python3 setup.py --full       # Full setup + start
    python3 setup.py --nuke       # Kill everything, clean, reinstall, start fresh
"""

import os
import re
import sys
import subprocess
import shutil
import signal
import time
import secrets
import textwrap
import argparse
from pathlib import Path

# ─── Constants ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR / "backend"
FRONTEND_DIR = SCRIPT_DIR / "frontend"
ENV_FILE = BACKEND_DIR / ".env"

# Process patterns to identify GUI-related processes (not the main RSF API daemon)
PROCESS_KILL_PATTERNS = [
    r"tsx.*server\.ts",
    r"node.*rustsploit.gui",
    r"npm\s+exec\s+tsx",
    r"vite",
    r"esbuild.*--service.*--ping",
]

BANNER = r"""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗ ██╗   ██╗███████╗████████╗███████╗██████╗ ██╗      ║
║   ██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗██║      ║
║   ██████╔╝██║   ██║███████╗   ██║   ███████╗██████╔╝██║      ║
║   ██╔══██╗██║   ██║╚════██║   ██║   ╚════██║██╔═══╝ ██║      ║
║   ██║  ██║╚██████╔╝███████║   ██║   ███████║██║     ███████╗  ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚══════╝  ║
║                         GUI Setup Tool                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"""

# ─── Colors ─────────────────────────────────────────────────────────────────────

class C:
    """ANSI color codes."""
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    WHITE   = "\033[97m"

def banner():
    print(f"{C.CYAN}{BANNER}{C.RESET}")

def info(msg):
    print(f"  {C.BLUE}ℹ{C.RESET}  {msg}")

def success(msg):
    print(f"  {C.GREEN}✓{C.RESET}  {msg}")

def warn(msg):
    print(f"  {C.YELLOW}⚠{C.RESET}  {C.YELLOW}{msg}{C.RESET}")

def error(msg):
    print(f"  {C.RED}✗{C.RESET}  {C.RED}{msg}{C.RESET}")

def header(msg):
    width = 60
    print()
    print(f"  {C.CYAN}{'─' * width}{C.RESET}")
    print(f"  {C.BOLD}{C.WHITE}{msg}{C.RESET}")
    print(f"  {C.CYAN}{'─' * width}{C.RESET}")

def prompt(msg, default=None):
    """Prompt user for input with optional default."""
    if default:
        val = input(f"  {C.MAGENTA}?{C.RESET}  {msg} {C.DIM}[{default}]{C.RESET}: ").strip()
        return val if val else default
    return input(f"  {C.MAGENTA}?{C.RESET}  {msg}: ").strip()

def confirm(msg, default=True):
    """Yes/no prompt."""
    suffix = "Y/n" if default else "y/N"
    val = input(f"  {C.MAGENTA}?{C.RESET}  {msg} {C.DIM}[{suffix}]{C.RESET}: ").strip().lower()
    if not val:
        return default
    return val in ("y", "yes")

# ─── Helpers ────────────────────────────────────────────────────────────────────

def check_command(cmd):
    """Check if a command exists on PATH."""
    return shutil.which(cmd) is not None

def run(cmd, cwd=None, capture=False, env=None):
    """Run a shell command, streaming output unless capture=True."""
    merged_env = {**os.environ, **(env or {})}
    try:
        if capture:
            result = subprocess.run(
                cmd, shell=True, cwd=cwd, capture_output=True,
                text=True, env=merged_env, timeout=120
            )
            return result
        else:
            result = subprocess.run(
                cmd, shell=True, cwd=cwd, env=merged_env, timeout=300
            )
            return result
    except subprocess.TimeoutExpired:
        error(f"Command timed out: {cmd}")
        return None
    except Exception as e:
        error(f"Command failed: {e}")
        return None

def load_env_file():
    """Load existing .env file into a dict."""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    env_vars[key.strip()] = val.strip()
    return env_vars

# ─── Process Management ────────────────────────────────────────────────────────

def find_gui_processes():
    """Find all RustSploit GUI-related processes (not the main RSF API daemon)."""
    result = run("ps aux", capture=True)
    if not result or result.returncode != 0:
        return []

    pids = []
    combined_pattern = "|".join(PROCESS_KILL_PATTERNS)
    my_pid = os.getpid()

    for line in result.stdout.splitlines():
        # Skip grep itself and our own process
        if "grep" in line or f" {my_pid} " in line:
            continue
        if re.search(combined_pattern, line):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    pid = int(parts[1])
                    if pid != my_pid:
                        pids.append((pid, line.strip()))
                except ValueError:
                    continue
    return pids

def kill_gui_processes():
    """Kill all RustSploit GUI-related processes (backend, frontend, esbuild).
    Does NOT touch the main RSF Rust API daemon."""
    header("Killing GUI Processes")

    procs = find_gui_processes()
    if not procs:
        success("No GUI processes found running")
        return True

    info(f"Found {len(procs)} GUI process(es) to kill:")
    for pid, cmdline in procs:
        # Truncate long lines for display
        display = cmdline[:100] + "..." if len(cmdline) > 100 else cmdline
        print(f"    {C.DIM}PID {pid}: {display}{C.RESET}")

    print()

    # Pass 1: SIGTERM (graceful)
    info("Sending SIGTERM (graceful shutdown)...")
    for pid, _ in procs:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass  # Already dead
        except PermissionError:
            warn(f"  No permission to kill PID {pid} (owned by another user)")

    time.sleep(2)

    # Check survivors
    survivors = find_gui_processes()
    if survivors:
        # Pass 2: SIGKILL (force)
        warn(f"{len(survivors)} process(es) still alive — sending SIGKILL...")
        for pid, _ in survivors:
            try:
                os.kill(pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass

        time.sleep(1)

    # Final check
    remaining = find_gui_processes()
    if remaining:
        warn(f"{len(remaining)} process(es) could not be killed (may be owned by root)")
        for pid, cmdline in remaining:
            display = cmdline[:80] + "..." if len(cmdline) > 80 else cmdline
            print(f"    {C.DIM}PID {pid}: {display}{C.RESET}")
        return False
    else:
        success("All GUI processes killed")
        return True

# ─── Clean Build Artifacts ──────────────────────────────────────────────────────

def clean_build_artifacts():
    """Remove node_modules, package-lock.json, dist, and SQLite DB for a fresh start."""
    header("Cleaning Build Artifacts")

    clean_targets = [
        (BACKEND_DIR / "node_modules", "Backend node_modules"),
        (BACKEND_DIR / "package-lock.json", "Backend package-lock.json"),
        (BACKEND_DIR / "dist", "Backend dist/"),
        (FRONTEND_DIR / "node_modules", "Frontend node_modules"),
        (FRONTEND_DIR / "package-lock.json", "Frontend package-lock.json"),
        (FRONTEND_DIR / "dist", "Frontend dist/"),
    ]

    for path, label in clean_targets:
        if path.exists():
            if path.is_dir():
                info(f"Removing {label} ({_dir_size_mb(path):.1f} MB)...")
                shutil.rmtree(path, ignore_errors=True)
            else:
                info(f"Removing {label}...")
                path.unlink(missing_ok=True)

            if not path.exists():
                success(f"  {label} removed")
            else:
                warn(f"  Failed to fully remove {label}")
        else:
            info(f"  {label} — already clean")

    return True

def _dir_size_mb(path):
    """Get approximate directory size in MB."""
    total = 0
    try:
        for entry in path.rglob("*"):
            if entry.is_file():
                total += entry.stat().st_size
    except (PermissionError, OSError):
        pass
    return total / (1024 * 1024)

# ─── RSF API Auto-Detection ────────────────────────────────────────────────────

def detect_rsf_api():
    """Auto-detect the running RSF API URL and API key from running processes."""
    header("Auto-Detecting RSF API")

    result = run("ps aux", capture=True)
    if not result or result.returncode != 0:
        warn("Could not read process list")
        return None, None

    candidates = []
    for line in result.stdout.splitlines():
        if "rustsploit" in line.lower() and "--api" in line and "--api-key" in line:
            # Extract --api-key value
            key_match = re.search(r"--api-key\s+(\S+)", line)
            iface_match = re.search(r"--interface\s+(\S+)", line)

            if key_match:
                api_key = key_match.group(1)
                if iface_match:
                    interface = iface_match.group(1)
                    # Convert 0.0.0.0 to 127.0.0.1 for local access
                    host, _, port = interface.rpartition(":")
                    if host == "0.0.0.0":
                        host = "127.0.0.1"
                    api_url = f"http://{host}:{port}" if port else f"http://{host}:8080"
                else:
                    api_url = "http://127.0.0.1:8080"

                candidates.append((api_url, api_key, line.strip()))

    if not candidates:
        warn("No running RSF API instances found")
        info("You'll need to enter the API URL and key manually")
        return None, None

    if len(candidates) == 1:
        url, key, cmdline = candidates[0]
        success(f"Found RSF API: {url}")
        success(f"API Key: {key[:4]}{'*' * (len(key)-8)}{key[-4:]}" if len(key) > 8 else f"API Key: {key}")
        return url, key

    # Multiple instances — let user pick
    info(f"Found {len(candidates)} RSF API instance(s):")
    print()
    for i, (url, key, cmdline) in enumerate(candidates):
        key_masked = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else key
        print(f"    {C.BOLD}{i+1}.{C.RESET} {C.CYAN}{url}{C.RESET}  key={key_masked}")
        # Show if it's the user's own process or a system one
        parts = cmdline.split()
        owner = parts[0] if parts else "?"
        print(f"       {C.DIM}owner={owner}{C.RESET}")
    print()

    choice = prompt(f"Which instance to use? (1-{len(candidates)})", "1")
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(candidates):
            url, key, _ = candidates[idx]
            return url, key
    except ValueError:
        pass

    warn("Invalid choice — using first instance")
    url, key, _ = candidates[0]
    return url, key

# ─── Port Availability ──────────────────────────────────────────────────────────

def check_port_available(port):
    """Check if a port is available."""
    result = run(f"ss -tlnp | grep ':{port} '", capture=True)
    return not (result and result.stdout.strip())

def wait_for_port(port, timeout=15):
    """Wait until a port is listening."""
    for _ in range(timeout * 2):
        if not check_port_available(port):
            return True
        time.sleep(0.5)
    return False

# ─── Prerequisites ──────────────────────────────────────────────────────────────

def check_prerequisites():
    """Verify Node.js and npm are installed."""
    header("Checking Prerequisites")

    ok = True

    # Node.js
    if check_command("node"):
        result = run("node --version", capture=True)
        if result and result.returncode == 0:
            version = result.stdout.strip()
            success(f"Node.js: {version}")
            major = int(version.lstrip("v").split(".")[0])
            if major < 18:
                warn(f"Node.js {version} detected — v18+ recommended")
        else:
            error("Node.js found but could not get version")
            ok = False
    else:
        error("Node.js not found — install it from https://nodejs.org")
        ok = False

    # npm
    if check_command("npm"):
        result = run("npm --version", capture=True)
        if result and result.returncode == 0:
            success(f"npm: v{result.stdout.strip()}")
        else:
            error("npm found but could not get version")
            ok = False
    else:
        error("npm not found — it should come with Node.js")
        ok = False

    # Check directories exist
    if BACKEND_DIR.is_dir():
        success(f"Backend directory: {BACKEND_DIR}")
    else:
        error(f"Backend directory not found: {BACKEND_DIR}")
        ok = False

    if FRONTEND_DIR.is_dir():
        success(f"Frontend directory: {FRONTEND_DIR}")
    else:
        error(f"Frontend directory not found: {FRONTEND_DIR}")
        ok = False

    return ok

# ─── Environment Config ────────────────────────────────────────────────────────

def setup_env(auto_detect=True):
    """Generate or update the backend .env file."""
    header("Environment Configuration")

    existing = {}
    if ENV_FILE.exists():
        info(f"Found existing .env at {ENV_FILE}")
        existing = load_env_file()
        if not confirm("Overwrite existing .env?", default=False):
            success("Keeping existing .env")
            return existing

    # Auto-detect RSF API
    detected_url, detected_key = None, None
    if auto_detect:
        detected_url, detected_key = detect_rsf_api()

    print()
    info("Configure the backend environment variables:")
    print()

    port = prompt("Backend port", existing.get("PORT", "4000"))
    cors = prompt("CORS origin (frontend URL)", existing.get("CORS_ORIGIN", "http://localhost:5173"))

    # JWT secret
    if "JWT_SECRET" in existing:
        jwt_secret = existing["JWT_SECRET"]
        info(f"Using existing JWT secret: {jwt_secret[:8]}...{jwt_secret[-4:]}")
    else:
        jwt_secret = secrets.token_hex(32)
        success(f"Generated JWT secret: {jwt_secret[:8]}...{jwt_secret[-4:]}")

    # RSF API — use auto-detected values as defaults
    default_url = detected_url or existing.get("RSF_API_URL", "http://127.0.0.1:8080")
    default_key = detected_key or existing.get("RSF_API_KEY", "")

    rsf_url = prompt("RustSploit API URL", default_url)
    rsf_key = prompt("RustSploit API Key", default_key)

    if not rsf_key:
        warn("No API key set — the GUI won't be able to communicate with the RSF API")
        warn("You can set it later in: backend/.env  (RSF_API_KEY=your_key)")

    env_content = textwrap.dedent(f"""\
        # ═══════════════════════════════════════════════════════════
        # RustSploit GUI — Backend Environment Configuration
        # Generated by setup.py on {time.strftime('%Y-%m-%d %H:%M:%S')}
        # ═══════════════════════════════════════════════════════════

        # Server
        PORT={port}
        CORS_ORIGIN={cors}

        # Authentication
        JWT_SECRET={jwt_secret}

        # RustSploit API Connection
        RSF_API_URL={rsf_url}
        RSF_API_KEY={rsf_key}
    """)

    with open(ENV_FILE, "w") as f:
        f.write(env_content)

    success(f"Environment config written to {ENV_FILE}")

    return {
        "PORT": port,
        "CORS_ORIGIN": cors,
        "JWT_SECRET": jwt_secret,
        "RSF_API_URL": rsf_url,
        "RSF_API_KEY": rsf_key,
    }

# ─── Dependency Installation ───────────────────────────────────────────────────

def install_deps():
    """Install npm dependencies for both backend and frontend."""
    header("Installing Dependencies")

    # Backend
    info("Installing backend dependencies...")
    if (BACKEND_DIR / "node_modules").is_dir():
        info("Backend node_modules exists — running npm install to ensure up-to-date")
    result = run("npm install", cwd=str(BACKEND_DIR))
    if result and result.returncode == 0:
        success("Backend dependencies installed")
    else:
        error("Failed to install backend dependencies")
        return False

    print()

    # Frontend
    info("Installing frontend dependencies...")
    if (FRONTEND_DIR / "node_modules").is_dir():
        info("Frontend node_modules exists — running npm install to ensure up-to-date")
    result = run("npm install", cwd=str(FRONTEND_DIR))
    if result and result.returncode == 0:
        success("Frontend dependencies installed")
    else:
        error("Failed to install frontend dependencies")
        return False

    return True

# ─── Build ──────────────────────────────────────────────────────────────────────

def build_backend():
    """Typecheck the backend."""
    header("Building Backend")
    info("Running TypeScript compilation check...")
    result = run("npx tsc --noEmit", cwd=str(BACKEND_DIR))
    if result and result.returncode == 0:
        success("Backend TypeScript — no errors")
        return True
    else:
        warn("Backend has TypeScript errors (may still work in dev mode with tsx)")
        return True  # Don't fail — tsx dev mode is more lenient

def build_frontend():
    """Build the frontend for production."""
    header("Building Frontend")
    info("Running Vite production build...")
    result = run("npx vite build", cwd=str(FRONTEND_DIR))
    if result and result.returncode == 0:
        success("Frontend built successfully")
        return True
    else:
        error("Frontend build failed")
        return False

# ─── Dev Servers ────────────────────────────────────────────────────────────────

def start_dev_servers(env_vars=None):
    """Start both backend and frontend dev servers."""
    header("Starting Development Servers")

    # Load .env if not provided
    if not env_vars:
        env_vars = load_env_file()

    backend_port = env_vars.get("PORT", "4000")
    frontend_port = "5173"

    # Check if ports are already in use
    if not check_port_available(int(backend_port)):
        warn(f"Port {backend_port} is already in use!")
        if confirm("Kill existing processes on that port?"):
            run(f"fuser -k {backend_port}/tcp", capture=True)
            time.sleep(1)
        else:
            error("Cannot start backend — port occupied")
            return

    if not check_port_available(5173):
        warn("Port 5173 is already in use!")
        if confirm("Kill existing processes on that port?"):
            run("fuser -k 5173/tcp", capture=True)
            time.sleep(1)
        else:
            error("Cannot start frontend — port occupied")
            return

    merged_env = {**os.environ, **env_vars}

    info(f"Backend  → http://localhost:{backend_port}")
    info(f"Frontend → http://localhost:{frontend_port}")
    print()

    procs = []

    try:
        # Start backend
        info("Starting backend (Express + tsx watch)...")
        backend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(BACKEND_DIR),
            env=merged_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid,
        )
        procs.append(("Backend", backend_proc))
        success(f"Backend started (PID: {backend_proc.pid})")

        # Wait for backend to be ready
        info("Waiting for backend to start...")
        if wait_for_port(int(backend_port), timeout=15):
            success(f"Backend listening on port {backend_port}")
        else:
            warn("Backend may still be starting up...")

        # Start frontend
        info("Starting frontend (Vite dev server)...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            env=merged_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid,
        )
        procs.append(("Frontend", frontend_proc))
        success(f"Frontend started (PID: {frontend_proc.pid})")

        # Wait for frontend
        info("Waiting for frontend to start...")
        if wait_for_port(5173, timeout=10):
            success("Frontend listening on port 5173")
        else:
            warn("Frontend may still be starting up...")

        # Verify health
        print()
        time.sleep(1)
        _print_health_summary(backend_port, frontend_port, env_vars)

        print()
        print(f"  {C.DIM}Press Ctrl+C to stop both servers{C.RESET}")
        print(f"  {C.CYAN}{'═' * 60}{C.RESET}")
        print()

        # Stream output from both processes
        import selectors
        sel = selectors.DefaultSelector()
        for name, proc in procs:
            sel.register(proc.stdout, selectors.EVENT_READ, name)

        while True:
            # Check if any process has died
            for name, proc in procs:
                ret = proc.poll()
                if ret is not None:
                    error(f"{name} process exited with code {ret}")
                    # Kill the other process
                    for other_name, other_proc in procs:
                        if other_name != name and other_proc.poll() is None:
                            try:
                                os.killpg(os.getpgid(other_proc.pid), signal.SIGTERM)
                            except:
                                pass
                    return

            events = sel.select(timeout=1)
            for key, _ in events:
                line = key.fileobj.readline()
                if line:
                    name = key.data
                    tag = f"{C.CYAN}[{name:8s}]{C.RESET}" if name == "Backend" else f"{C.MAGENTA}[{name:8s}]{C.RESET}"
                    print(f"  {tag} {line.rstrip()}")

    except KeyboardInterrupt:
        print()
        info("Shutting down servers...")
        for name, proc in procs:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                proc.wait(timeout=5)
                success(f"{name} stopped")
            except Exception:
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    pass
                warn(f"{name} force-killed")
        print()
        success("All servers stopped")


def _print_health_summary(backend_port, frontend_port, env_vars):
    """Print a summary box with URLs, health, and login info."""
    # Quick health checks
    backend_ok = False
    result = run(f"curl -s http://localhost:{backend_port}/health 2>/dev/null", capture=True)
    if result and result.returncode == 0 and "ok" in result.stdout:
        backend_ok = True

    frontend_ok = False
    result = run(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{frontend_port}/ 2>/dev/null", capture=True)
    if result and result.stdout.strip() == "200":
        frontend_ok = True

    rsf_url = env_vars.get("RSF_API_URL", "http://127.0.0.1:8080")
    rsf_ok = False
    result = run(f"curl -s -o /dev/null -w '%{{http_code}}' {rsf_url}/api/status 2>/dev/null", capture=True)
    if result and result.stdout.strip() in ("200", "401"):
        rsf_ok = True

    print(f"  {C.CYAN}{'═' * 60}{C.RESET}")
    print(f"  {C.BOLD}{C.GREEN}✓ Setup Complete!{C.RESET}")
    print()
    be_status = f"{C.GREEN}✓ OK{C.RESET}" if backend_ok else f"{C.YELLOW}⏳ Starting{C.RESET}"
    fe_status = f"{C.GREEN}✓ OK{C.RESET}" if frontend_ok else f"{C.YELLOW}⏳ Starting{C.RESET}"
    rsf_status = f"{C.GREEN}✓ Connected{C.RESET}" if rsf_ok else f"{C.RED}✗ Unreachable{C.RESET}"
    print(f"    {C.WHITE}Frontend:{C.RESET}  {C.CYAN}http://localhost:{frontend_port}{C.RESET}  {fe_status}")
    print(f"    {C.WHITE}Backend:{C.RESET}   {C.CYAN}http://localhost:{backend_port}{C.RESET}  {be_status}")
    print(f"    {C.WHITE}RSF API:{C.RESET}   {C.DIM}{rsf_url}{C.RESET}  {rsf_status}")
    print()
    print(f"    {C.WHITE}Login:{C.RESET}     {C.DIM}admin / RustSploit2024!{C.RESET}")

# ─── Health Check ───────────────────────────────────────────────────────────────

def check_status():
    """Check if the services are running and healthy."""
    header("Service Health Check")

    # Check running processes
    procs = find_gui_processes()
    if procs:
        success(f"GUI processes: {len(procs)} running")
    else:
        warn("GUI processes: NONE running")

    # Check if backend port is in use
    if not check_port_available(4000):
        result = run("curl -s http://localhost:4000/health 2>/dev/null", capture=True)
        if result and "ok" in (result.stdout or ""):
            success("Backend (port 4000): HEALTHY")
        else:
            warn("Backend (port 4000): PORT IN USE but not responding to /health")
    else:
        warn("Backend (port 4000): NOT RUNNING")

    # Check if frontend port is in use
    if not check_port_available(5173):
        result = run("curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ 2>/dev/null", capture=True)
        if result and result.stdout.strip() == "200":
            success("Frontend (port 5173): HEALTHY")
        else:
            warn("Frontend (port 5173): PORT IN USE but not responding")
    else:
        warn("Frontend (port 5173): NOT RUNNING")

    # Check RSF API instances
    rsf_url = "http://127.0.0.1:8080"
    env = load_env_file()
    if env.get("RSF_API_URL"):
        rsf_url = env["RSF_API_URL"]

    result = run(f"curl -s -o /dev/null -w '%{{http_code}}' {rsf_url}/api/status 2>/dev/null", capture=True)
    code = result.stdout.strip() if result else ""
    if code == "200":
        success(f"RSF API ({rsf_url}): HEALTHY")
    elif code == "401":
        success(f"RSF API ({rsf_url}): REACHABLE (auth required)")
    elif code:
        warn(f"RSF API ({rsf_url}): HTTP {code}")
    else:
        warn(f"RSF API ({rsf_url}): NOT REACHABLE")

    # Check .env
    if ENV_FILE.exists():
        env_data = load_env_file()
        key_status = "SET" if env_data.get("RSF_API_KEY") else "NOT SET"
        success(f".env file: {ENV_FILE} (API key: {key_status})")
    else:
        warn(f".env file: NOT FOUND — run 'python3 setup.py' to create it")

    # Check node_modules
    if (BACKEND_DIR / "node_modules").is_dir():
        success("Backend node_modules: INSTALLED")
    else:
        warn("Backend node_modules: MISSING — run 'python3 setup.py --install'")

    if (FRONTEND_DIR / "node_modules").is_dir():
        success("Frontend node_modules: INSTALLED")
    else:
        warn("Frontend node_modules: MISSING — run 'python3 setup.py --install'")

# ─── Nuke (Full Reset) ─────────────────────────────────────────────────────────

def nuke_and_rebuild():
    """Kill everything, clean everything, reinstall, and start fresh."""
    header("☢️  NUKE — Full Reset from Scratch")
    print()
    warn("This will:")
    print(f"    {C.RED}1.{C.RESET} Kill all GUI processes (tsx, vite, esbuild, node)")
    print(f"    {C.RED}2.{C.RESET} Delete node_modules, package-lock.json, and dist/ from both projects")
    print(f"    {C.RED}3.{C.RESET} Regenerate .env with auto-detected RSF API settings")
    print(f"    {C.RED}4.{C.RESET} Fresh npm install for backend & frontend")
    print(f"    {C.RED}5.{C.RESET} Start both dev servers")
    print()

    if not confirm("Are you sure you want to nuke everything?", default=False):
        info("Aborted")
        return

    # Step 1: Kill processes
    kill_gui_processes()

    # Step 2: Clean everything
    clean_build_artifacts()

    # Step 3: Prerequisites check
    if not check_prerequisites():
        error("Prerequisites check failed — fix the issues above and try again")
        sys.exit(1)

    # Step 4: Environment setup with auto-detection
    env_vars = setup_env(auto_detect=True)

    # Step 5: Fresh install
    if not install_deps():
        error("Dependency installation failed")
        sys.exit(1)

    # Step 6: Quick build check
    build_backend()

    # Step 7: Start servers
    print()
    start_dev_servers(env_vars)

# ─── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="RustSploit GUI — Setup & Launch Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python3 setup.py              Interactive full setup
              python3 setup.py --install    Install dependencies only
              python3 setup.py --start      Start dev servers only
              python3 setup.py --build      Build for production
              python3 setup.py --status     Check service health
              python3 setup.py --full       Full setup + start servers
              python3 setup.py --nuke       Kill everything, clean, reinstall, start fresh
              python3 setup.py --kill       Kill all GUI processes
              python3 setup.py --clean      Remove node_modules and build artifacts
        """)
    )
    parser.add_argument("--install",  action="store_true", help="Install dependencies only")
    parser.add_argument("--start",    action="store_true", help="Start dev servers only")
    parser.add_argument("--build",    action="store_true", help="Build for production")
    parser.add_argument("--status",   action="store_true", help="Check service health")
    parser.add_argument("--full",     action="store_true", help="Full setup + start")
    parser.add_argument("--nuke",     action="store_true", help="Kill all, clean, reinstall, start fresh")
    parser.add_argument("--kill",     action="store_true", help="Kill all GUI processes")
    parser.add_argument("--clean",    action="store_true", help="Remove node_modules and build artifacts")
    parser.add_argument("--no-color", action="store_true", help="Disable colored output")

    args = parser.parse_args()

    # Disable colors if requested or not a TTY
    if args.no_color or not sys.stdout.isatty():
        for attr in vars(C):
            if not attr.startswith("_"):
                setattr(C, attr, "")

    banner()

    # ── Specific modes ──

    if args.status:
        check_status()
        return

    if args.kill:
        kill_gui_processes()
        return

    if args.clean:
        if find_gui_processes():
            warn("GUI processes are still running!")
            if confirm("Kill them first?"):
                kill_gui_processes()
            else:
                warn("Cleaning with running processes may cause issues")
        clean_build_artifacts()
        return

    if args.install:
        if not check_prerequisites():
            error("Prerequisites check failed")
            sys.exit(1)
        if not install_deps():
            sys.exit(1)
        success("Done!")
        return

    if args.start:
        # Kill any existing GUI processes first
        existing = find_gui_processes()
        if existing:
            warn(f"Found {len(existing)} existing GUI process(es)")
            if confirm("Kill them before starting?"):
                kill_gui_processes()
        start_dev_servers()
        return

    if args.build:
        if not check_prerequisites():
            sys.exit(1)
        build_backend()
        build_frontend()
        return

    if args.nuke:
        nuke_and_rebuild()
        return

    if args.full:
        # Kill existing processes
        existing = find_gui_processes()
        if existing:
            warn(f"Found {len(existing)} existing GUI process(es)")
            kill_gui_processes()

        if not check_prerequisites():
            error("Prerequisites check failed")
            sys.exit(1)
        env_vars = setup_env(auto_detect=True)
        if not install_deps():
            sys.exit(1)
        build_backend()
        print()
        if confirm("Start development servers now?"):
            start_dev_servers(env_vars)
        else:
            print()
            info("To start later, run:")
            info(f"  python3 {__file__} --start")
        return

    # ── Interactive mode (default) ──

    # Check for existing processes
    existing = find_gui_processes()
    if existing:
        warn(f"Found {len(existing)} existing GUI process(es) running")
        if confirm("Kill them?"):
            kill_gui_processes()

    if not check_prerequisites():
        error("Prerequisites check failed — fix the issues above and try again")
        sys.exit(1)

    env_vars = setup_env(auto_detect=True)

    print()
    if confirm("Install/update npm dependencies?"):
        if not install_deps():
            sys.exit(1)
    else:
        info("Skipping dependency installation")

    print()
    if confirm("Run build checks?"):
        build_backend()

    print()
    if confirm("Start development servers now?"):
        start_dev_servers(env_vars)
    else:
        print()
        header("Setup Complete")
        print()
        info("To start the servers later:")
        info(f"  {C.BOLD}python3 {Path(__file__).name} --start{C.RESET}")
        print()
        info("Or manually:")
        info(f"  {C.DIM}cd backend  && npm run dev{C.RESET}")
        info(f"  {C.DIM}cd frontend && npm run dev{C.RESET}")
        print()
        info(f"Frontend: {C.CYAN}http://localhost:5173{C.RESET}")
        info(f"Backend:  {C.CYAN}http://localhost:{env_vars.get('PORT', '4000')}{C.RESET}")
        info(f"Login:    {C.DIM}admin / RustSploit2024!{C.RESET}")
        print()


if __name__ == "__main__":
    main()
