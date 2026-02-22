#!/usr/bin/env bash
# Title AI Nova — start both services for end-to-end testing
# Usage: ./start.sh
set -e

echo "=== Title AI Nova — startup ==="

# ── 1. Python Nova Act service ──────────────────────────────────────────────
echo ""
echo "[1/2] Starting Nova Act service (port 8001)..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOVA_SERVICE_DIR="$SCRIPT_DIR/nova-act-service"

# Install Python deps if needed
if ! python3 -c "import flask" 2>/dev/null; then
  echo "  Installing Python dependencies..."
  pip3 install -r "$NOVA_SERVICE_DIR/requirements.txt" --quiet
fi

# Export AWS credentials from .env.local into the Python process
set -a
# shellcheck disable=SC1091
[ -f "$SCRIPT_DIR/.env.local" ] && source <(grep -v '^#' "$SCRIPT_DIR/.env.local" | grep '=')
set +a

# Start the service in the background
python3 "$NOVA_SERVICE_DIR/main.py" &
NOVA_PID=$!
echo "  Nova Act service PID: $NOVA_PID"

# Wait for the service to be ready
echo "  Waiting for Nova Act service..."
for i in {1..15}; do
  if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
    STATUS=$(curl -s http://localhost:8001/health)
    echo "  Ready! $STATUS"
    break
  fi
  sleep 1
done

# ── 2. Next.js dev server ───────────────────────────────────────────────────
echo ""
echo "[2/2] Starting Next.js dev server (port 3000)..."
cd "$SCRIPT_DIR"
npm run dev &
NEXT_PID=$!
echo "  Next.js PID: $NEXT_PID"

echo ""
echo "=== Both services running ==="
echo "  Next.js:          http://localhost:3000"
echo "  Title AI:         http://localhost:3000/titleai"
echo "  Nova Act service: http://localhost:8001/health"
echo ""
echo "Press Ctrl+C to stop both services."

# Trap Ctrl+C and kill both processes
trap "echo ''; echo 'Stopping...'; kill $NOVA_PID $NEXT_PID 2>/dev/null; exit 0" INT TERM
wait $NEXT_PID
