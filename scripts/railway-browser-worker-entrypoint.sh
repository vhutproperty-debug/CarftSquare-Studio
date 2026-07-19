#!/usr/bin/env bash
# Railway Browser Worker boot — proxy on PORT, then worker (per-session Xvfb/noVNC).
set -euo pipefail

echo "[boot] starting Prop/Research Browser Worker"
echo "[boot] node=$(node -v 2>/dev/null || echo missing) pwd=$(pwd) PORT=${PORT:-unset}"
echo "[boot] RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-unset}"
echo "[boot] dockerfile=Dockerfile.browser-worker (expect railway.json builder=DOCKERFILE)"

# Keep npm Playwright and image browsers on the same tree (matches Dockerfile ENV).
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}"
echo "[boot] PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}"

# Fail immediately if Chromium is missing — do not wait for a Connect job.
if [ -f scripts/verify-playwright-chromium.mjs ]; then
  echo "[boot] verifying Playwright Chromium…"
  node scripts/verify-playwright-chromium.mjs || {
    echo "[boot] FATAL: Playwright Chromium missing. Redeploy with Dockerfile.browser-worker build that runs: npx playwright install --with-deps chromium"
    exit 1
  }
else
  echo "[boot] FATAL: scripts/verify-playwright-chromium.mjs missing from image"
  exit 1
fi

# Internal worker port (proxy owns Railway PORT).
export RESEARCH_BROWSER_WORKER_PORT="${RESEARCH_BROWSER_WORKER_PORT:-4173}"
export RESEARCH_BROWSER_WORKER_HOST="${RESEARCH_BROWSER_WORKER_HOST:-127.0.0.1}"

# Public HTTPS base for signed noVNC links (Railway custom/service domain).
if [ -z "${RESEARCH_BROWSER_WORKER_PUBLIC_URL:-}" ]; then
  if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
    export RESEARCH_BROWSER_WORKER_PUBLIC_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
  fi
fi
echo "[boot] RESEARCH_BROWSER_WORKER_PUBLIC_URL=${RESEARCH_BROWSER_WORKER_PUBLIC_URL:-unset}"

# Default DISPLAY for any non-remote tooling; connect sessions allocate their own :N.
export DISPLAY="${DISPLAY:-:99}"
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  echo "[boot] starting fallback Xvfb on $DISPLAY"
  Xvfb "$DISPLAY" -screen 0 1365x900x24 -ac +extension GLX +render -noreset &
  sleep 1
fi

for bin in Xvfb x11vnc websockify; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[boot] WARN: $bin not found on PATH"
  else
    echo "[boot] ok: $bin"
  fi
done
if [ -f /usr/share/novnc/vnc.html ]; then
  echo "[boot] ok: noVNC web root /usr/share/novnc"
elif [ -f /usr/share/novnc/vnc_lite.html ]; then
  echo "[boot] ok: noVNC lite at /usr/share/novnc/vnc_lite.html"
else
  echo "[boot] WARN: noVNC web files not found under /usr/share/novnc"
fi

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

echo "[boot] starting worker via tsx (internal ${RESEARCH_BROWSER_WORKER_HOST}:${RESEARCH_BROWSER_WORKER_PORT})"
set +e
"$TSX_BIN" scripts/research-browser-worker.ts
WORKER_EXIT=$?
set -e
echo "[boot] worker exited with code ${WORKER_EXIT}"
exit "$WORKER_EXIT"
