#!/usr/bin/env bash
# Railway Browser Worker boot — proxy on PORT first, then Xvfb + worker.
set -euo pipefail

echo "[boot] starting Prop/Research Browser Worker"
echo "[boot] node=$(node -v 2>/dev/null || echo missing) pwd=$(pwd) PORT=${PORT:-unset}"
echo "[boot] RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-unset}"

# Internal worker port (proxy owns Railway PORT).
export RESEARCH_BROWSER_WORKER_PORT="${RESEARCH_BROWSER_WORKER_PORT:-4173}"
export RESEARCH_BROWSER_WORKER_HOST="${RESEARCH_BROWSER_WORKER_HOST:-127.0.0.1}"

TSX_BIN="./node_modules/.bin/tsx"
if [ ! -x "$TSX_BIN" ]; then
  echo "[boot] FATAL: $TSX_BIN not found or not executable"
  ls -la ./node_modules/.bin 2>/dev/null | head -50 || true
  exit 1
fi

echo "[boot] starting edge proxy on PORT=${PORT:-8080}"
node scripts/railway-worker-proxy.mjs &
PROXY_PID=$!

cleanup() {
  kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Manual Xvfb — more reliable than xvfb-run under some containers.
export DISPLAY="${DISPLAY:-:99}"
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  echo "[boot] starting Xvfb on $DISPLAY"
  Xvfb "$DISPLAY" -screen 0 1365x900x24 -ac +extension GLX +render -noreset &
  XVFB_PID=$!
  sleep 1
  if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "[boot] FATAL: Xvfb failed to start"
    exit 1
  fi
fi

echo "[boot] starting worker via tsx (internal ${RESEARCH_BROWSER_WORKER_HOST}:${RESEARCH_BROWSER_WORKER_PORT})"
# Keep proxy alive; worker is the long-running foreground process.
set +e
"$TSX_BIN" scripts/research-browser-worker.ts
WORKER_EXIT=$?
set -e
echo "[boot] worker exited with code ${WORKER_EXIT}"
exit "$WORKER_EXIT"
