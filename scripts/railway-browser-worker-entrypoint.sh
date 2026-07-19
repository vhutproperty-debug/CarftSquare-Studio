#!/usr/bin/env bash
# Railway Browser Worker boot — log early, ensure xvfb, run worker on PORT.
set -euo pipefail

echo "[boot] starting Prop/Research Browser Worker"
echo "[boot] node=$(node -v 2>/dev/null || echo missing) pwd=$(pwd) PORT=${PORT:-unset}"
echo "[boot] RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-unset}"

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "[boot] xvfb-run missing — installing xvfb"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb
fi

TSX_BIN="./node_modules/.bin/tsx"
if [ ! -x "$TSX_BIN" ]; then
  echo "[boot] FATAL: $TSX_BIN not found or not executable"
  ls -la ./node_modules/.bin 2>/dev/null | head -50 || true
  exit 1
fi

echo "[boot] exec xvfb-run + tsx scripts/research-browser-worker.ts"
exec xvfb-run --auto-servernum --server-args="-screen 0 1365x900x24" "$TSX_BIN" scripts/research-browser-worker.ts
