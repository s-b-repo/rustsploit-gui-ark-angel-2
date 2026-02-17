#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_PATH="$SCRIPT_DIR/nginx.conf"

if [ ! -f "$CONF_PATH" ]; then
    echo "❌ nginx.conf not found at $CONF_PATH"
    exit 1
fi

# Stop any existing nginx instance using this config
sudo nginx -p "$SCRIPT_DIR" -s stop 2>/dev/null || true

echo "Starting Nginx reverse proxy..."
sudo nginx -p "$SCRIPT_DIR" -c "$CONF_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Nginx proxy started on http://0.0.0.0:8888"
    echo "   Frontend -> http://127.0.0.1:5173"
    echo "   Backend  -> http://127.0.0.1:4000"
    echo ""
    echo "To stop: sudo nginx -p \"$SCRIPT_DIR\" -s stop"
else
    echo "❌ Failed to start Nginx"
    exit 1
fi
